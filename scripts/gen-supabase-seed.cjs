// Generates docs/supabase-seed.sql from the local backend backup export.
// Usage: node scripts/gen-supabase-seed.cjs <path-to-backup.json>
const fs = require('fs');

const backupPath = process.argv[2] || '.aq_backup_tmp.json';
const d = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const data = d.data || d;
const now = new Date().toISOString();

const state = {
  users: [],
  customers: data.customers || [],
  invoices: data.invoices || [],
  receipts: data.receipts || [],
  ledger: data.ledgerTransactions || [],
  shipments: data.shipments || [],
  bankAccounts: data.bankAccounts || [],
  remittanceProfiles: data.remittanceProfiles || [],
  payments: data.payments || [],
  auditEvents: (data.auditEvents || []).slice(0, 100),
  syncMeta: {}
};
for (const k of ['invoices', 'receipts', 'ledger', 'customers', 'shipments', 'bankAccounts', 'remittanceProfiles', 'payments', 'auditEvents']) {
  state.syncMeta[k] = now;
}

const json = JSON.stringify(state);
const counts = {};
for (const k of ['invoices', 'receipts', 'ledger', 'customers', 'shipments', 'bankAccounts', 'remittanceProfiles', 'payments', 'auditEvents']) {
  counts[k] = state[k].length;
}
console.error('seeded collections:', JSON.stringify(counts), 'sizeKB:', Math.round(json.length / 1024));

const sql = `-- ============================================================
-- AQ Companies Portal - Supabase cloud state bootstrap
-- Run ONCE in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Creates the sync tables and seeds them with the exported
-- data from the local backend.
-- ============================================================

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

-- Seed (or reset) the primary cloud state with the exported data
DELETE FROM aq_online_state WHERE id = 'primary_state';
INSERT INTO aq_online_state (id, state_data, version, updated_at)
VALUES ('primary_state', $json$${json}$json$::jsonb, 1, NOW());

INSERT INTO aq_state_history (version, snapshot_data, created_at)
VALUES (1, $json$${json}$json$::jsonb, NOW());
`;

fs.writeFileSync(__dirname + '/../docs/supabase-seed.sql', sql);
console.error('written docs/supabase-seed.sql');
