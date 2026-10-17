import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/utils/jwt.js';

describe('Backup & Restore System Tests (Admin & Compliance)', () => {
  const app = createApp();

  const viewerToken = signAccessToken({
    userId: 'test-viewer-id',
    email: 'viewer@aqcompanies.com',
    roles: ['VIEWER'],
    permissions: ['invoice:view', 'ledger:view']
  });

  const adminToken = signAccessToken({
    userId: 'test-admin-id',
    email: 'admin@aqcompanies.com',
    roles: ['ADMIN'],
    permissions: ['*']
  });

  let exportedBackup: any = null;

  it('TC-BKP-01: denies non-admin from exporting system backup with 403', async () => {
    const res = await request(app)
      .get('/api/admin/backup/export')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('TC-BKP-02: allows ADMIN to export full system backup archive with valid metadata and checksum', async () => {
    const res = await request(app)
      .get('/api/admin/backup/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('checksum');
    expect(res.body).toHaveProperty('metadata');
    expect(res.body).toHaveProperty('tables');
    expect(res.body.tables).toHaveProperty('invoices');
    expect(res.body.tables).toHaveProperty('ledgerTransactions');
    expect(res.body.tables).toHaveProperty('receipts');
    expect(res.body.metadata.counts.invoices).toBeGreaterThanOrEqual(1);

    exportedBackup = res.body;
  });

  it('TC-BKP-03: validates uploaded backup against live database and returns structured diff', async () => {
    expect(exportedBackup).toBeDefined();

    const res = await request(app)
      .post('/api/admin/backup/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ backup: exportedBackup });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.checksumValid).toBe(true);
    expect(res.body).toHaveProperty('diff');
    expect(res.body.diff).toHaveProperty('invoices');
    expect(res.body.diff).toHaveProperty('ledger');
    expect(res.body).toHaveProperty('preview');
  });

  it('TC-BKP-04: rejects corrupted or invalid backup payloads during validation', async () => {
    const corrupted = {
      version: '1.0',
      tables: {}
      // missing checksum and metadata
    };

    const res = await request(app)
      .post('/api/admin/backup/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ backup: corrupted });

    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
  });

  it('TC-BKP-05: executes transactional system restore and logs SYSTEM_RESTORE_SUCCESS audit event', async () => {
    expect(exportedBackup).toBeDefined();

    const res = await request(app)
      .post('/api/admin/backup/restore')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ backup: exportedBackup });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.restoredCounts.invoices).toBeGreaterThanOrEqual(1);

    // Verify audit trail logged SYSTEM_RESTORE_SUCCESS
    const auditRes = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(auditRes.status).toBe(200);
    const hasRestoreEvent = auditRes.body.events.some((ev: any) => ev.action === 'SYSTEM_RESTORE_SUCCESS');
    expect(hasRestoreEvent).toBe(true);
  });
});
