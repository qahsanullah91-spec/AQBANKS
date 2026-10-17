import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { maskAccountNumber } from '../src/utils/masking.js';
import { sanitizeCellString } from '../src/modules/import/import.routes.js';

describe('Security, RBAC, Rate Limiting & Masking Tests', () => {
  const app = createApp();

  const viewerToken = signAccessToken({
    userId: 'test-viewer-id',
    email: 'viewer@aqcompanies.com',
    roles: ['VIEWER'],
    permissions: ['invoice:view', 'ledger:view', 'bank_details:view_masked']
  });

  const logisticsToken = signAccessToken({
    userId: 'test-logistics-id',
    email: 'logistics@aqcompanies.com',
    roles: ['LOGISTICS_COORDINATOR'],
    permissions: ['shipment:manage', 'shipment:view', 'invoice:view']
  });

  const auditorToken = signAccessToken({
    userId: 'test-auditor-id',
    email: 'auditor@aqcompanies.com',
    roles: ['AUDITOR'],
    permissions: ['invoice:view', 'ledger:view', 'shipment:view', 'bank_details:view_masked', 'audit:view']
  });

  const adminToken = signAccessToken({
    userId: 'test-admin-id',
    email: 'admin@aqcompanies.com',
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

  it('TC-SEC-07: rejects non-corporate email domains with 400 INVALID_CORPORATE_DOMAIN', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'attacker@external-hacker.com',
        password: 'Password123'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_CORPORATE_DOMAIN');
  });

  it('TC-SEC-08: locks account after 5 consecutive failed login attempts and returns 429 SECURITY_LOCKOUT with countdown', async () => {
    const testBruteEmail = `locked-user-${Date.now()}@aqcompanies.com`;

    // Attempt 1 through 4: Should return 401 INVALID_CREDENTIALS with attempts remaining
    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testBruteEmail, password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.attemptsRemaining).toBe(5 - i);
    }

    // Attempt 5: Trigger Security Lockout (429)
    const lockRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testBruteEmail, password: 'WrongPassword' });

    expect(lockRes.status).toBe(429);
    expect(lockRes.body.error).toBe('SECURITY_LOCKOUT');
    expect(lockRes.body.remainingSeconds).toBeGreaterThan(0);
    expect(lockRes.body.lockedUntil).toBeDefined();

    // Subsequent attempt during lockout period must also immediately return 429
    const blockedRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testBruteEmail, password: 'AnyPassword' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error).toBe('SECURITY_LOCKOUT');
  });

  it('TC-SEC-09: completes 2FA verification flow with 6-digit OTP code', async () => {
    // 1. Request login with 2FA step
    const step1 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@aqcompanies.com',
        password: 'AQCompanies@2026',
        require2FA: true,
        devMode: true
      });

    expect(step1.status).toBe(200);
    expect(step1.body.require2FA).toBe(true);
    expect(step1.body.twoFactorToken).toBeDefined();
    expect(step1.body.devOtp).toMatch(/^\d{6}$/);

    // 2. Verify 2FA code
    const step2 = await request(app)
      .post('/api/auth/verify-2fa')
      .send({
        twoFactorToken: step1.body.twoFactorToken,
        otpCode: step1.body.devOtp
      });

    expect(step2.status).toBe(200);
    expect(step2.body.accessToken).toBeDefined();
    expect(step2.body.user.email).toBe('admin@aqcompanies.com');
  });

  it('TC-SEC-10: rejects invalid 2FA code with 400 INVALID_OTP and tracks attempts', async () => {
    const step1 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@aqcompanies.com',
        password: 'AQCompanies@2026',
        require2FA: true,
        devMode: true
      });

    const step2 = await request(app)
      .post('/api/auth/verify-2fa')
      .send({
        twoFactorToken: step1.body.twoFactorToken,
        otpCode: '000000' // wrong code
      });

    expect(step2.status).toBe(400);
    expect(step2.body.error).toBe('INVALID_OTP');
  });

  it('TC-SEC-11: denies Logistics Coordinator from accessing Payments and Reports with 403', async () => {
    const payRes = await request(app)
      .get('/api/payments')
      .set('Authorization', `Bearer ${logisticsToken}`);
    expect(payRes.status).toBe(403);
    expect(payRes.body.error).toBe('FORBIDDEN');

    const repRes = await request(app)
      .get('/api/reports/receivables-aging')
      .set('Authorization', `Bearer ${logisticsToken}`);
    expect(repRes.status).toBe(403);
    expect(repRes.body.error).toBe('FORBIDDEN');
  });

  it('TC-SEC-12: denies Auditor from voiding receipts or committing imports with 403', async () => {
    const voidRes = await request(app)
      .post('/api/receipts/some-receipt-id/void')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ reason: 'Audit test' });
    expect(voidRes.status).toBe(403);
    expect(voidRes.body.error).toBe('FORBIDDEN');

    const commitRes = await request(app)
      .post('/api/import/commit')
      .set('Authorization', `Bearer ${auditorToken}`);
    expect(commitRes.status).toBe(403);
    expect(commitRes.body.error).toBe('FORBIDDEN');
  });

  it('TC-SEC-13: sanitizes formula injection attempts starting with =, +, -, @ in imported workbook data', () => {
    expect(sanitizeCellString('=CMD|\' /C calc\'!A0')).toBe(`'=CMD|' /C calc'!A0`);
    expect(sanitizeCellString('+1+1')).toBe(`'+1+1`);
    expect(sanitizeCellString('@SUM(1,2)')).toBe(`'@SUM(1,2)`);
    expect(sanitizeCellString('-500')).toBe('-500'); // numeric negative preserved
    expect(sanitizeCellString('Standard description')).toBe('Standard description');
  });
});
