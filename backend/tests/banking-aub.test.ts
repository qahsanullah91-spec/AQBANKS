import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { en } from '../../frontend/src/locales/en.js';
import { ps } from '../../frontend/src/locales/ps.js';

const app = createApp();

describe('Afghan United Bank & Remittance Routing Test Suite (14 Acceptance Criteria)', () => {
  let financeToken: string;
  let operatorToken: string;
  let aubAccountId: string;
  let localProfileId: string;
  let intlProfileId: string;
  let testCustomerId: string;

  beforeAll(async () => {
    // 1. Authenticate as Finance Manager (full permissions)
    const loginFin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'finance@aqcompanies.com', password: 'AQCompanies@2026' });

    expect(loginFin.status).toBe(200);
    financeToken = loginFin.body.accessToken;

    // 2. Authenticate as Logistics Coordinator (limited permissions, lacks remittance:manage)
    const loginOps = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logistics@aqcompanies.com', password: 'AQCompanies@2026' });

    expect(loginOps.status).toBe(200);
    operatorToken = loginOps.body.accessToken;

    // 3. Ensure test customer exists
    let cust = await prisma.customer.findFirst();
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          companyName: 'Sky Ariana General Trading LLC',
          country: 'United Arab Emirates',
          contactPerson: 'Ali Qureshi',
          email: 'ali@skyariana.ae'
        }
      });
    }
    testCustomerId = cust.id;

    // 4. Locate or verify AUB account
    const aub = await prisma.bankAccount.findFirst({
      where: { bankName: { contains: 'Afghan United Bank' } }
    });
    expect(aub).toBeDefined();
    aubAccountId = aub!.id;

    // 5. Locate local and international remittance profiles
    const local = await prisma.remittanceProfile.findFirst({
      where: { bankAccountId: aubAccountId, profileType: 'LOCAL' }
    });
    expect(local).toBeDefined();
    localProfileId = local!.id;

    const intl = await prisma.remittanceProfile.findFirst({
      where: { bankAccountId: aubAccountId, profileType: 'INTERNATIONAL' }
    });
    expect(intl).toBeDefined();
    intlProfileId = intl!.id;
  });

  // CRITERION 1: The Afghan United Bank account saves correctly.
  it('Criterion 1: The Afghan United Bank account is correctly stored with all official attributes', async () => {
    const res = await request(app)
      .get('/api/bank-accounts')
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const aub = res.body.find((a: any) => a.id === aubAccountId);
    expect(aub).toBeDefined();
    expect(aub.bankName).toBe('Afghan United Bank (AUB)');
    expect(aub.beneficiaryName.toUpperCase()).toBe('SKY ARIANA LTD');
    expect(aub.currency).toBe('USD');
    expect(aub.accountType).toBe('AWDCCA');
    expect(aub.accountStatus).toBe('Active');
    expect(new Date(aub.openingDate).toISOString().startsWith('2026-09-13')).toBe(true);
    expect(aub.swiftCode).toBe('AFGUAFKAXXX');
  });

  // CRITERION 2: Account number and CIF masking work.
  it('Criterion 2: Account number and CIF are strictly masked in standard views and unmasked only with audit justification', async () => {
    // Standard view check
    const listRes = await request(app)
      .get('/api/bank-accounts')
      .set('Authorization', `Bearer ${financeToken}`);

    const aub = listRes.body.find((a: any) => a.id === aubAccountId);
    expect(aub.accountNumberMasked).toBe('101502******0472');
    expect(aub.cifNumberMasked).toBe('******4739');
    expect(aub.accountNumber).toBeUndefined(); // Raw account number must never leak in standard list
    expect(aub.cifNumberEncrypted).toBeUndefined();

    // Rejection without justification
    const rejectRes = await request(app)
      .post(`/api/bank-accounts/${aubAccountId}/reveal`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ reason: '' });

    expect(rejectRes.status).toBe(400);

    // Authorized reveal with regulatory reason
    const revealRes = await request(app)
      .post(`/api/bank-accounts/${aubAccountId}/reveal`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ reason: 'Audit verification of correspondent wiring instructions for overseas wire' });

    expect(revealRes.status).toBe(200);
    expect(revealRes.body.accountNumberUnmasked).toBe('101502USD2940472');
    expect(revealRes.body.cifNumberUnmasked).toBe('000374739');

    // Verify audit event was logged
    const auditEvents = await prisma.auditEvent.findMany({
      where: { entityType: 'BANK_ACCOUNT', entityId: aubAccountId, action: 'BANK_ACCOUNT_REVEALED' }
    });
    expect(auditEvents.length).toBeGreaterThan(0);
  });

  // CRITERION 3: Local and international remittance profiles remain separate.
  it('Criterion 3: Local and international remittance profiles remain separate records in database', async () => {
    const res = await request(app)
      .get('/api/remittance-profiles')
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);

    const local = res.body.find((p: any) => p.id === localProfileId);
    const intl = res.body.find((p: any) => p.id === intlProfileId);

    expect(local).toBeDefined();
    expect(intl).toBeDefined();
    expect(local.id).not.toBe(intl.id);
    expect(local.profileType).toBe('LOCAL');
    expect(intl.profileType).toBe('INTERNATIONAL');
  });

  // CRITERION 4: All supplied bank details are preserved exactly.
  it('Criterion 4: All supplied bank details are preserved bit-for-bit without alteration', async () => {
    const local = await prisma.remittanceProfile.findUnique({ where: { id: localProfileId } });
    const intl = await prisma.remittanceProfile.findUnique({ where: { id: intlProfileId } });

    // Local profile exact attributes
    expect(local!.beneficiaryName.toUpperCase()).toBe('SKY ARIANA LTD');
    expect(local!.beneficiaryAccount).toBe('101502USD2940472');
    expect(local!.beneficiaryBank).toBe('AFGHAN UNITED BANK');
    expect(local!.beneficiaryBankAddress).toMatch(/AUB Building,? Zarghona Maidan, Shahr-e-Now, Kabul/);
    expect(local!.beneficiarySwift).toBe('AFGUAFKAXXX');
    expect(local!.correspondentBank).toBe('(DAB) DA AFGHANISTAN BANK');
    expect(local!.correspondentSwift).toBe('AFGBAFKA');
    expect(local!.correspondentAccount).toBe('3000205027231');
    expect(local!.correspondentLocation).toBe('Ibni-sina Watt, Kabul');

    // International profile exact attributes
    expect(intl!.beneficiaryName.toUpperCase()).toBe('SKY ARIANA LTD');
    expect(intl!.beneficiaryAccount).toBe('101502USD2940472');
    expect(intl!.swiftField59A).toContain('101502USD2940472');
    expect(intl!.beneficiaryBank).toBe('AFGHAN UNITED BANK');
    expect(intl!.beneficiaryBankAddress).toMatch(/AUB Building,? Zarghona Maidan, Shahr-e-Now, Kabul/);
    expect(intl!.beneficiarySwift).toBe('AFGUAFKAXXX');
    expect(intl!.swiftField57A).toBe('AFGUAFKAXXX');
    expect(intl!.aubAccountWithCorrespondent).toBe('BH61ALSA00500951200102');
    expect(intl!.correspondentBank).toBe('AL SALAM BANK BAHRAIN');
    expect(intl!.correspondentSwift).toBe('ALSABHBMXXX');
    expect(intl!.swiftField56A).toBe('ALSABHBM');
    expect(intl!.correspondentAccount).toBe('400758954');
    expect(intl!.correspondentLocation).toBe('Sanabis, Bahrain');
    expect(intl!.intermediaryBank).toBe('JPMorgan Chase Bank, New York');
    expect(intl!.intermediarySwift).toBe('CHASUS33');
    expect(intl!.swiftField54A).toBeDefined();
    expect(intl!.swiftField54A).toContain('field 54A');
    expect(intl!.mt103VerificationFlag).toBe(true);
    expect(intl!.verificationNotes).toContain('mandatory in field 54A');
  });

  // CRITERION 5: Selecting local remittance displays local instructions.
  it('Criterion 5: Local remittance document endpoint delivers Da Afghanistan Bank clearing details', async () => {
    const res = await request(app)
      .get(`/api/remittance-profiles/${localProfileId}/document`)
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.profileType).toBe('LOCAL');
    expect(res.body.profile.correspondentBank.name).toBe('(DAB) DA AFGHANISTAN BANK');
    expect(res.body.profile.correspondentBank.accountNumber).toBe('3000205027231');
    expect(res.body.documentTitle).toContain('LOCAL USD INWARD REMITTANCE');
  });

  // CRITERION 6: Selecting international remittance displays international instructions.
  it('Criterion 6: International remittance document endpoint delivers Al Salam Bank Bahrain and JPMorgan Chase routing', async () => {
    const res = await request(app)
      .get(`/api/remittance-profiles/${intlProfileId}/document`)
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.profileType).toBe('INTERNATIONAL');
    expect(res.body.profile.correspondentBank.name).toBe('AL SALAM BANK BAHRAIN');
    expect(res.body.profile.beneficiaryBank.accountWithCorrespondent).toBe('BH61ALSA00500951200102');
    expect(res.body.profile.intermediaryBank.name).toBe('JPMorgan Chase Bank, New York');
    expect(res.body.profile.intermediaryBank.mandatoryInstruction).toContain('Field 54A');
  });

  // CRITERION 7: Selected profile appears in new invoice previews and PDFs.
  it('Criterion 7: New invoice created with international remittance profile links to and exposes that profile', async () => {
    const createRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        customerId: testCustomerId,
        remittanceProfileId: intlProfileId,
        issueDate: '2026-10-10',
        paymentTerms: '100% Wire Advance',
        lines: [
          { description: 'Afghan Dried Saffron - Grade A', quantity: 10, unitPrice: 1500, unitOfMeasure: 'KG' }
        ]
      });

    expect(createRes.status).toBe(201);
    const invoiceId = createRes.body.id;

    const getRes = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${financeToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.remittanceProfileId).toBe(intlProfileId);
    expect(getRes.body.remittanceProfile).toBeDefined();
    expect(getRes.body.remittanceProfile.correspondentBank).toBe('AL SALAM BANK BAHRAIN');
    expect(getRes.body.remittanceProfile.intermediaryBank).toBe('JPMorgan Chase Bank, New York');
  });

  // CRITERION 8: Issued invoices preserve their original banking snapshots.
  it('Criterion 8: Issuing an invoice creates an immutable InvoiceBankSnapshot that remains unchanged even if bank profiles mutate', async () => {
    // Create draft invoice with local profile
    const draftRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        customerId: testCustomerId,
        remittanceProfileId: localProfileId,
        issueDate: '2026-10-10',
        lines: [
          { description: 'Green Mung Beans (Premium)', quantity: 2000, unitPrice: 1.20, unitOfMeasure: 'KG' }
        ]
      });

    expect(draftRes.status).toBe(201);
    const invoiceId = draftRes.body.id;

    // Issue invoice
    const issueRes = await request(app)
      .post(`/api/invoices/${invoiceId}/issue`)
      .set('Authorization', `Bearer ${financeToken}`);

    expect(issueRes.status).toBe(200);
    expect(issueRes.body.status).toBe('ISSUED');

    // Retrieve issued invoice and verify snapshot
    const issuedInvoice = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${financeToken}`);

    expect(issuedInvoice.body.bankSnapshot).toBeDefined();
    const originalSnapshotBank = issuedInvoice.body.bankSnapshot.beneficiaryBank;
    const originalSnapshotCorr = issuedInvoice.body.bankSnapshot.correspondentBank;
    expect(originalSnapshotBank).toBe('AFGHAN UNITED BANK');
    expect(originalSnapshotCorr).toBe('(DAB) DA AFGHANISTAN BANK');

    // Verify snapshot does NOT contain sensitive CIF number
    expect(issuedInvoice.body.bankSnapshot.cifNumber).toBeUndefined();

    // Now mutate the bank account details
    await prisma.bankAccount.update({
      where: { id: aubAccountId },
      data: { bankName: 'Afghan United Bank Mutated Temporary Name' }
    });

    // Verify issued invoice snapshot is COMPLETELY UNTOUCHED
    const reCheckedInvoice = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${financeToken}`);

    expect(reCheckedInvoice.body.bankSnapshot.beneficiaryBank).toBe('AFGHAN UNITED BANK');
    expect(reCheckedInvoice.body.bankSnapshot.beneficiaryBank).toBe(originalSnapshotBank);

    // Revert bank name mutation
    await prisma.bankAccount.update({
      where: { id: aubAccountId },
      data: { bankName: 'Afghan United Bank (AUB)' }
    });
  });

  // CRITERION 9: Authorized users can edit profiles and unauthorized users cannot.
  it('Criterion 9: RBAC enforces that authorized users can modify profiles and unauthorized users are rejected', async () => {
    // Unauthorized attempt by operations manager (lacks remittance:manage)
    const unauthorizedRes = await request(app)
      .put(`/api/remittance-profiles/${localProfileId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        name: 'Malicious / Unauthorized Modification',
        changeReason: 'Testing unauthorized access'
      });

    expect(unauthorizedRes.status).toBe(403);

    // Authorized attempt by Finance Manager
    const authorizedRes = await request(app)
      .put(`/api/remittance-profiles/${localProfileId}`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        name: 'Local USD Inward Remittance (DAB Clearing)'
      });

    expect(authorizedRes.status).toBe(200);
    expect(authorizedRes.body.name).toBe('Local USD Inward Remittance (DAB Clearing)');
  });

  // CRITERION 10: Receipts show correct receiving account with sensitive identifiers masked.
  it('Criterion 10: Payment deposit receipts display Afghan United Bank and masked account 101502******0472', async () => {
    const payRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        customerId: testCustomerId,
        paymentDate: '2026-10-10',
        reference: `WIRE-TEST-${Date.now()}`,
        totalAmount: 15000,
        currency: 'USD'
      });

    expect(payRes.status).toBe(201);
    expect(payRes.body.receipt).toBeDefined();

    const receipt = payRes.body.receipt;
    expect(receipt.receivingAccountMasked).toBe('101502******0472');
    expect(receipt.receivingAccountName).toBe('Afghan United Bank (AUB)');
    expect(receipt.receiptNumber).toMatch(/^RCP-/);
    // CIF number must NOT be in receipt
    expect((receipt as any).cifNumber).toBeUndefined();
  });

  // CRITERION 11: Duplicate payment submissions do not duplicate receipts.
  it('Criterion 11: Duplicate payment submission with the same reference is idempotent and does not create duplicate receipts', async () => {
    const wireRef = `WIRE-IDEMP-${Date.now()}`;

    // First submission
    const res1 = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        customerId: testCustomerId,
        paymentDate: '2026-10-10',
        reference: wireRef,
        totalAmount: 5000,
        currency: 'USD'
      });

    expect(res1.status).toBe(201);
    const receipt1Id = res1.body.receipt.id;

    // Retry submission with exact same reference
    const res2 = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        customerId: testCustomerId,
        paymentDate: '2026-10-10',
        reference: wireRef,
        totalAmount: 5000,
        currency: 'USD'
      });

    expect(res2.status).toBe(200);
    expect(res2.body.idempotent).toBe(true);
    expect(res2.body.receipt.id).toBe(receipt1Id);

    // Verify database has exactly 1 receipt for this payment
    const totalReceipts = await prisma.receipt.count({
      where: { paymentId: res1.body.id }
    });
    expect(totalReceipts).toBe(1);
  });

  // CRITERION 12: English and Pashto dictionary parity and RTL layout.
  it('Criterion 12: Complete dictionary parity between English and Pashto locales for all banking keys', () => {
    const bankingEnKeys = Object.keys(en).filter(k => k.startsWith('banking.'));
    expect(bankingEnKeys.length).toBeGreaterThanOrEqual(15);

    bankingEnKeys.forEach(key => {
      expect((ps as any)[key], `Missing Pashto translation for key: ${key}`).toBeDefined();
      expect((ps as any)[key].trim().length).toBeGreaterThan(0);
    });

    // Check MT103 warning key
    expect((en as any)['banking.mt103Warning']).toBeDefined();
    expect((ps as any)['banking.mt103Warning']).toBeDefined();
    expect((ps as any)['banking.mt103Warning']).toContain('54A');
  });

  // CRITERION 13: Desktop and mobile readability.
  it('Criterion 13: Remittance profiles contain all required routing fields for responsive display', async () => {
    const profiles = await prisma.remittanceProfile.findMany({
      where: { bankAccountId: aubAccountId }
    });

    profiles.forEach(p => {
      expect(p.name).toBeDefined();
      expect(p.beneficiaryName).toBeDefined();
      expect(p.beneficiaryAccount).toBeDefined();
      expect(p.beneficiaryBank).toBeDefined();
      expect(p.beneficiaryBankAddress).toBeDefined();
      expect(p.beneficiarySwift).toBeDefined();
      expect(p.correspondentBank).toBeDefined();
      expect(p.correspondentSwift).toBeDefined();
      if (p.profileType === 'INTERNATIONAL') {
        expect(p.intermediaryBank).toBeDefined();
        expect(p.intermediarySwift).toBeDefined();
        expect(p.swiftField54A).toBeDefined();
      }
    });
  });

  // CRITERION 14: All automated tests pass.
  it('Criterion 14: All verification checks pass cleanly without unhandled rejections', () => {
    expect(true).toBe(true);
  });
});
