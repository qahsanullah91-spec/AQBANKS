import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { maskAccountNumber } from '../src/utils/masking.js';

describe('Security, RBAC & Masking Tests', () => {
  const app = createApp();

  const viewerToken = signAccessToken({
    userId: 'test-viewer-id',
    email: 'viewer@test.com',
    roles: ['VIEWER'],
    permissions: ['invoice:view', 'ledger:view', 'bank_details:view_masked']
  });

  const logisticsToken = signAccessToken({
    userId: 'test-logistics-id',
    email: 'logistics@test.com',
    roles: ['LOGISTICS_COORDINATOR'],
    permissions: ['shipment:manage', 'shipment:view']
  });

  const adminToken = signAccessToken({
    userId: 'test-admin-id',
    email: 'admin@test.com',
    roles: ['ADMIN'],
    permissions: ['*']
  });

  it('TC-SEC-01: masks bank account numbers correctly by default', () => {
    expect(maskAccountNumber('101502USD2940472')).toBe('101502******0472');
    expect(maskAccountNumber('1234567890')).toBe('123456******7890');
    expect(maskAccountNumber('12345')).toBe('******2345');
  });

  it('TC-SEC-02: denies unauthenticated access to protected endpoints with 401', async () => {
    const res = await request(app).get('/api/ledger');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('TC-SEC-03: denies logistics coordinator from posting ledger entries with 403', async () => {
    const res = await request(app)
      .post('/api/ledger')
      .set('Authorization', `Bearer ${logisticsToken}`)
      .send({
        effectiveDate: '2026-10-09',
        description: 'Unauthorized Entry',
        category: 'CREDIT',
        creditAmount: 1000
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('TC-SEC-04: denies viewer from revealing unmasked bank details with 403', async () => {
    const res = await request(app)
      .post('/api/bank-accounts/dummy-id/reveal')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ reason: 'Curious' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('TC-SEC-05: allows authenticated viewer to view masked bank accounts', async () => {
    const res = await request(app)
      .get('/api/bank-accounts')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0].accountNumberMasked).toContain('******');
      expect(res.body[0].accountNumberEncrypted).toBeUndefined();
    }
  });

  it('TC-SEC-06: health check returns 200 pass without requiring authentication', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pass');
  });
});
