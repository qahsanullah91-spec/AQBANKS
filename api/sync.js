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
  `);
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

    if (req.method === 'GET') {
      const result = await client.query(
        'SELECT state_data, version, updated_at FROM aq_online_state WHERE id = $1',
        ['primary_state']
      );

      if (result.rows.length === 0) {
        // Auto-seed with verified initial dataset
        const seed = getSeedData();
        if (seed) {
          const insertRes = await client.query(`
            INSERT INTO aq_online_state (id, state_data, version, updated_at)
            VALUES ('primary_state', $1, 1, NOW())
            RETURNING state_data, version, updated_at;
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
      const state = body?.state || body;

      if (!state || typeof state !== 'object') {
        return res.status(400).json({ error: 'Invalid state payload' });
      }

      // Upsert into aq_online_state
      const upsertResult = await client.query(`
        INSERT INTO aq_online_state (id, state_data, version, updated_at)
        VALUES ('primary_state', $1, 1, NOW())
        ON CONFLICT (id) DO UPDATE SET
          state_data = EXCLUDED.state_data,
          version = aq_online_state.version + 1,
          updated_at = NOW()
        RETURNING version, updated_at;
      `, [JSON.stringify(state)]);

      const row = upsertResult.rows[0];
      return res.status(200).json({
        success: true,
        version: row.version,
        updatedAt: row.updated_at,
        message: 'Online cloud state successfully synchronized'
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
