/**
 * Cloud state endpoint for the AQ Companies portal.
 *
 * Two storage backends are supported (first match wins):
 *   1. Supabase Data API  — set SUPABASE_URL + SUPABASE_SECRET_KEY.
 *      Works from Vercel serverless over HTTPS/IPv4 (no DB password or
 *      IPv6-capable host needed). Tables must exist — run
 *      docs/supabase-seed.sql once in the Supabase SQL Editor.
 *   2. Direct PostgreSQL  — set POSTGRES_URL (or POSTGRES_PRISMA_URL).
 *
 * Shared secret guard: set SYNC_TOKEN on the server (and VITE_SYNC_TOKEN at
 * build time) to lock the endpoint down; when unset it stays open so existing
 * deployments keep working.
 */

import fs from 'fs';

const SYNC_TOKEN = process.env.SYNC_TOKEN || '';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

const SYNC_COLLECTIONS = [
  'invoices', 'receipts', 'ledger', 'customers', 'shipments',
  'bankAccounts', 'remittanceProfiles', 'payments', 'auditEvents', 'users'
];

function isAuthorized(req) {
  if (!SYNC_TOKEN) return true;
  const headerToken = req.headers['x-sync-token'];
  const queryToken = req.query?.token;
  return headerToken === SYNC_TOKEN || queryToken === SYNC_TOKEN;
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

/**
 * Last-writer-wins merge at the collection level, driven by the client's
 * syncMeta stamps. Unlike a union merge this lets deletions propagate: a
 * collection whose incoming stamp is newer replaces the stored one entirely,
 * so entities removed on the client are removed in the cloud.
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

// ============================================================
// Supabase Data API (PostgREST) backend
// ============================================================
function restHeaders(prefer) {
  const h = {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json'
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

async function restGet(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: restHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase GET ${table} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function restInsert(table, rows, prefer) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: restHeaders(prefer || 'return=representation'),
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase POST ${table} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function restDelete(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: restHeaders('return=minimal')
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase DELETE ${table} failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

async function supabaseGetPrimaryRow() {
  const rows = await restGet('aq_online_state', 'id=eq.primary_state&select=state_data,version,updated_at');
  return rows[0] || null;
}

async function supabaseSeedPrimary() {
  const seed = getSeedData();
  if (!seed) return null;
  const rows = await restInsert('aq_online_state', [{
    id: 'primary_state',
    state_data: seed,
    version: 1,
    updated_at: new Date().toISOString()
  }]);
  await restInsert('aq_state_history', [{
    version: 1,
    snapshot_data: seed,
    created_at: new Date().toISOString()
  }]);
  return { row: rows[0], seeded: true };
}

async function supabaseHistory(req, res) {
  const hist = await restGet('aq_state_history', 'select=id,version,created_at&order=id.desc&limit=20');
  return res.status(200).json({ success: true, history: hist });
}

async function supabaseGet(req, res) {
  const sinceVersion = Number(req.query?.sinceVersion || 0);
  let row = await supabaseGetPrimaryRow();

  if (!row) {
    if (sinceVersion > 0) {
      return res.status(200).json({ success: true, exists: false, unchanged: true, version: 0 });
    }
    const seeded = await supabaseSeedPrimary();
    if (!seeded) {
      return res.status(200).json({ success: true, exists: false, data: null, message: 'No cloud state yet stored' });
    }
    return res.status(200).json({
      success: true,
      exists: true,
      seeded: true,
      data: seeded.row.state_data,
      version: seeded.row.version,
      updatedAt: seeded.row.updated_at
    });
  }

  const cloudVersion = Number(row.version || 0);
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

async function supabasePost(req, res) {
  const body = req.body;
  const rawState = body?.state || body;
  if (!rawState || typeof rawState !== 'object') {
    return res.status(400).json({ error: 'Invalid state payload' });
  }

  const currentRow = await supabaseGetPrimaryRow();
  let finalState = rawState;
  let nextVersion = 1;
  let baseVersion = 0;

  if (currentRow) {
    baseVersion = Number(currentRow.version || 0);
    nextVersion = baseVersion + 1;
    finalState = mergeStates(currentRow.state_data, rawState);
  }

  const nowIso = new Date().toISOString();
  await restInsert(
    'aq_online_state',
    [{ id: 'primary_state', state_data: finalState, version: nextVersion, updated_at: nowIso }],
    'return=minimal,resolution=merge-duplicates'
  );

  await restInsert('aq_state_history', [{
    version: nextVersion,
    snapshot_data: finalState,
    created_at: nowIso
  }], 'return=minimal');

  // Prune history to keep the last 50 snapshots
  try {
    const old = await restGet('aq_state_history', 'select=id&order=id.desc&limit=1000&offset=50');
    if (Array.isArray(old) && old.length > 0) {
      const ids = old.map(r => r.id).join(',');
      await restDelete('aq_state_history', `id=in.(${ids})`);
    }
  } catch (e) {
    console.warn('History prune skipped:', e.message);
  }

  return res.status(200).json({
    success: true,
    version: nextVersion,
    baseVersion,
    updatedAt: nowIso,
    data: finalState,
    message: 'Online cloud state successfully synchronized with Supabase'
  });
}

// ============================================================
// Direct PostgreSQL backend (legacy path, kept for compatibility)
// ============================================================
let pgPool;
function getPool() {
  if (!pgPool && connectionString) {
    const { Pool } = pgModule;
    pgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }
  return pgPool;
}

let pgModule;
async function loadPg() {
  if (!pgModule) pgModule = await import('pg');
  return pgModule;
}

async function pgHandler(req, res) {
  await loadPg();
  const p = getPool();
  if (!p) {
    return res.status(500).json({ error: 'Database connection configuration missing' });
  }

  let client;
  try {
    client = await p.connect();
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

    const action = req.query?.action;

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

      const curRes = await client.query(
        'SELECT state_data, version FROM aq_online_state WHERE id = $1',
        ['primary_state']
      );

      let finalState = rawState;
      let nextVersion = 1;
      let baseVersion = 0;

      if (curRes.rows.length > 0) {
        baseVersion = Number(curRes.rows[0].version || 0);
        nextVersion = baseVersion + 1;
        finalState = mergeStates(curRes.rows[0].state_data, rawState);
      }

      const upsertResult = await client.query(`
        INSERT INTO aq_online_state (id, state_data, version, updated_at)
        VALUES ('primary_state', $1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET
          state_data = EXCLUDED.state_data,
          version = EXCLUDED.version,
          updated_at = NOW()
        RETURNING version, updated_at;
      `, [JSON.stringify(finalState), nextVersion]);

      await client.query(`
        INSERT INTO aq_state_history (version, snapshot_data, created_at)
        VALUES ($1, $2, NOW());
      `, [nextVersion, JSON.stringify(finalState)]);

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
    if (client) client.release();
  }
}

// ============================================================
// Router
// ============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Sync-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized sync request' });
  }

  const useSupabase = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
  const usePostgres = Boolean(connectionString);

  if (!useSupabase && !usePostgres) {
    return res.status(500).json({
      error: 'Database connection configuration missing',
      hint: 'Set SUPABASE_URL + SUPABASE_SECRET_KEY (recommended) or POSTGRES_URL.'
    });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (useSupabase) {
    try {
      if (req.method === 'GET' && req.query?.action === 'history') {
        return await supabaseHistory(req, res);
      }
      if (req.method === 'GET') {
        return await supabaseGet(req, res);
      }
      return await supabasePost(req, res);
    } catch (err) {
      console.error('[API /api/sync] Supabase error:', err);
      return res.status(500).json({
        error: 'Cloud synchronization error',
        details: err.message
      });
    }
  }

  return pgHandler(req, res);
}
