import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

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

async function ensureTable(client) {
  await client.query(`
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
  `);
}

function mergeEntityArray(currentArr, incomingArr, idKey = 'id') {
  if (!Array.isArray(incomingArr)) return currentArr || [];
  if (!Array.isArray(currentArr) || currentArr.length === 0) return incomingArr;

  const map = new Map();
  for (const item of currentArr) {
    if (item && item[idKey]) {
      map.set(item[idKey], item);
    }
  }

  for (const item of incomingArr) {
    if (item && item[idKey]) {
      const existing = map.get(item[idKey]);
      if (existing) {
        map.set(item[idKey], { ...existing, ...item });
      } else {
        map.set(item[idKey], item);
      }
    }
  }

  return Array.from(map.values());
}

function mergeStates(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;

  return {
    ...current,
    ...incoming,
    invoices: mergeEntityArray(current.invoices, incoming.invoices, 'id'),
    receipts: mergeEntityArray(current.receipts, incoming.receipts, 'receiptNumber'),
    ledger: mergeEntityArray(current.ledger, incoming.ledger, 'id'),
    customers: mergeEntityArray(current.customers, incoming.customers, 'id'),
    shipments: mergeEntityArray(current.shipments, incoming.shipments, 'id'),
    bankAccounts: mergeEntityArray(current.bankAccounts, incoming.bankAccounts, 'id'),
    remittanceProfiles: mergeEntityArray(current.remittanceProfiles, incoming.remittanceProfiles, 'id'),
    payments: mergeEntityArray(current.payments, incoming.payments, 'id'),
    auditEvents: mergeEntityArray(current.auditEvents, incoming.auditEvents, 'id')
  };
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
      const result = await client.query(
        'SELECT state_data, version, updated_at FROM aq_online_state WHERE id = $1',
        ['primary_state']
      );

      if (result.rows.length === 0) {
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
      return res.status(200).json({
        success: true,
        exists: true,
        data: row.state_data,
        version: row.version,
        updatedAt: row.updated_at
      });
    }

    if (req.method === 'POST') {
      const body = req.body;
      const rawState = body?.state || body;

      if (!rawState || typeof rawState !== 'object') {
        return res.status(400).json({ error: 'Invalid state payload' });
      }

      // 1. Fetch current database state to perform conflict-free entity-level merge
      const curRes = await client.query(
        'SELECT state_data, version FROM aq_online_state WHERE id = $1',
        ['primary_state']
      );

      let finalState = rawState;
      let nextVersion = 1;

      if (curRes.rows.length > 0) {
        const currentState = curRes.rows[0].state_data;
        const currentVersion = curRes.rows[0].version;
        nextVersion = (currentVersion || 0) + 1;

        // Perform smart conflict-free entity merge
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
