import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

// Shared secret guard. Set SYNC_TOKEN in Vercel env vars (and VITE_SYNC_TOKEN on
// the frontend) to lock this endpoint down; when unset the endpoint stays open
// so existing deployments keep working.
const SYNC_TOKEN = process.env.SYNC_TOKEN || '';

const SYNC_COLLECTIONS = [
  'invoices', 'receipts', 'ledger', 'customers', 'shipments',
  'bankAccounts', 'remittanceProfiles', 'payments', 'auditEvents', 'users'
];

let pool;
function getPool() {
  if (!pool && connectionString) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }
  return pool;
}

function getSeedData() {
  try {
    const raw = fs.readFileSync(new URL('./seedData.json', import.meta.url), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read seedData.json:', e);
    return null;
  }
}

let tableReadyPromise = null;
function ensureTable(client) {
  if (!tableReadyPromise) {
    tableReadyPromise = client.query(`
      CREATE TABLE IF NOT EXISTS aq_online_state (
        id VARCHAR(50) PRIMARY KEY,
        state_data JSONB NOT NULL,
        version INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS aq_state_history (
        id SERIAL PRIMARY KEY,
        version INT NOT NULL,
        snapshot_data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `).catch((err) => {
      tableReadyPromise = null;
      throw err;
    });
  }
  return tableReadyPromise;
}

function isAuthorized(req) {
  if (!SYNC_TOKEN) return true;
  const headerToken = req.headers['x-sync-token'];
  const queryToken = req.query?.token;
  return headerToken === SYNC_TOKEN || queryToken === SYNC_TOKEN;
}

/**
 * Last-writer-wins merge at the collection level, driven by the client's
 * syncMeta stamps. Unlike the previous union merge this lets deletions
 * propagate: a collection whose incoming stamp is newer replaces the stored
 * one entirely, so entities removed on the client are removed in the cloud.
 */
function mergeStates(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;

  const curMeta = current.syncMeta || {};
  const incMeta = incoming.syncMeta || {};
  const merged = { ...current, ...incoming };

  for (const key of SYNC_COLLECTIONS) {
    const inc = incoming[key];
    if (inc === undefined) continue; // incoming doesn't carry this collection at all
    if (!Array.isArray(inc)) {
      merged[key] = inc;
      continue;
    }
    const incStamp = Date.parse(incMeta[key]) || 0;
    const curStamp = Date.parse(curMeta[key]) || 0;
    // No meta on either side (legacy payload): trust the writer.
    merged[key] = incStamp >= curStamp ? inc : (current[key] || inc);
  }

  merged.syncMeta = { ...curMeta, ...incMeta };
  return merged;
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Sync-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized sync request' });
  }

  const p = getPool();
  if (!p) {
    return res.status(500).json({ error: 'Database connection configuration missing' });
  }

  let client;
  try {
    client = await p.connect();
    await ensureTable(client);

    const action = req.query?.action;

    // Optional: Get restore points history
    if (req.method === 'GET' && action === 'history') {
      const hist = await client.query(
        'SELECT id, version, created_at FROM aq_state_history ORDER BY id DESC LIMIT 20;'
      );
      return res.status(200).json({ success: true, history: hist.rows });
    }

    if (req.method === 'GET') {
      const sinceVersion = Number(req.query?.sinceVersion || 0);

      const result = await client.query(
        'SELECT state_data, version, updated_at FROM aq_online_state WHERE id = $1',
        ['primary_state']
      );

      if (result.rows.length === 0) {
        // Delta poll against an empty cloud: nothing to send yet.
        if (sinceVersion > 0) {
          return res.status(200).json({ success: true, exists: false, unchanged: true, version: 0 });
        }
        const seed = getSeedData();
        if (seed) {
          const insertRes = await client.query(`
            INSERT INTO aq_online_state (id, state_data, version, updated_at)
            VALUES ('primary_state', $1, 1, NOW())
            RETURNING state_data, version, updated_at;
          `, [JSON.stringify(seed)]);

          await client.query(`
            INSERT INTO aq_state_history (version, snapshot_data, created_at)
            VALUES (1, $1, NOW());
          `, [JSON.stringify(seed)]);

          const row = insertRes.rows[0];
          return res.status(200).json({
            success: true,
            exists: true,
            seeded: true,
            data: row.state_data,
            version: row.version,
            updatedAt: row.updated_at
          });
        }

        return res.status(200).json({
          success: true,
          exists: false,
          data: null,
          message: 'No cloud state yet stored'
        });
      }

      const row = result.rows[0];
      const cloudVersion = Number(row.version || 0);

      // Delta poll: client is already up to date, skip the heavy payload.
      if (sinceVersion > 0 && cloudVersion <= sinceVersion) {
        return res.status(200).json({
          success: true,
          exists: true,
          unchanged: true,
          version: cloudVersion,
          updatedAt: row.updated_at
        });
      }

      return res.status(200).json({
        success: true,
        exists: true,
        data: row.state_data,
        version: cloudVersion,
        updatedAt: row.updated_at
      });
    }

    if (req.method === 'POST') {
      const body = req.body;
      const rawState = body?.state || body;

      if (!rawState || typeof rawState !== 'object') {
        return res.status(400).json({ error: 'Invalid state payload' });
      }

      // 1. Fetch current database state to perform collection-level merge
      const curRes = await client.query(
        'SELECT state_data, version FROM aq_online_state WHERE id = $1',
        ['primary_state']
      );

      let finalState = rawState;
      let nextVersion = 1;
      let baseVersion = 0;

      if (curRes.rows.length > 0) {
        const currentState = curRes.rows[0].state_data;
        baseVersion = Number(curRes.rows[0].version || 0);
        nextVersion = baseVersion + 1;

        // Perform conflict-free collection-level merge (deletion-aware)
        finalState = mergeStates(currentState, rawState);
      }

      // 2. Persist merged state to primary record
      const upsertResult = await client.query(`
        INSERT INTO aq_online_state (id, state_data, version, updated_at)
        VALUES ('primary_state', $1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET
          state_data = EXCLUDED.state_data,
          version = EXCLUDED.version,
          updated_at = NOW()
        RETURNING version, updated_at;
      `, [JSON.stringify(finalState), nextVersion]);

      // 3. Save snapshot to history table for disaster recovery & audit
      await client.query(`
        INSERT INTO aq_state_history (version, snapshot_data, created_at)
        VALUES ($1, $2, NOW());
      `, [nextVersion, JSON.stringify(finalState)]);

      // 4. Prune history to keep last 50 snapshots
      await client.query(`
        DELETE FROM aq_state_history
        WHERE id NOT IN (
          SELECT id FROM aq_state_history ORDER BY id DESC LIMIT 50
        );
      `);

      const row = upsertResult.rows[0];
      return res.status(200).json({
        success: true,
        version: row.version,
        baseVersion,
        updatedAt: row.updated_at,
        data: finalState,
        message: 'Online cloud state successfully synchronized with PostgreSQL'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[API /api/sync] Error:', err);
    return res.status(500).json({
      error: 'Cloud synchronization error',
      details: err.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
