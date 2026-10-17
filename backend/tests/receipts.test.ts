import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { numberToWords } from '../src/modules/receipts/receipts.util.js';

const app = createApp();

describe('Mandatory Automatic Receipt Generation & Workflow Tests', () => {
  let authToken: string;
  let customerId: string;
  let financialAccountId: string;

  beforeAll(async () => {
    // 1. Authenticate as Finance Manager
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'finance@aqcompanies.com', password: 'AQCompanies@2026' });

    authToken = loginRes.body.accessToken;

    // 2. Fetch or create test customer
    let cust = await prisma.customer.findFirst();
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          companyName: 'Test Importer Ltd',
          country: 'United Arab Emirates'
        }
      });
    }
    customerId = cust.id;

    // 3. Fetch or create test financial account
    let fin = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
    if (!fin) {
      fin = await prisma.financialAccount.create({
        data: {
          name: 'Afghan United Bank Operating Account',
          currency: 'USD',
          accountNumber: '1015020100472'
        }
      });
    }
    financialAccountId = fin.id;
  });

  it('TC-RCP-01: converts numbers to words accurately for legal receipting', () => {
    expect(numberToWords(0, 'USD')).toBe('Zero US Dollars and Zero Cents');
    expect(numberToWords(100, 'USD')).toBe('One Hundred US Dollars and Zero Cents');
    expect(numberToWords(153352.97, 'USD')).toBe('One Hundred Fifty-Three Thousand Three Hundred Fifty-Two US Dollars and Ninety-Seven Cents');
    expect(numberToWords(24259.61, 'USD')).toBe('Twenty-Four Thousand Two Hundred Fifty-Nine US Dollars and Sixty-One Cents');
  });

  it('TC-RCP-02: automatically creates exactly one receipt linked to posted incoming payment', async () => {
    const paymentAmount = 15000.50;
    const testRef = `WIRE-RCP-TEST-${Date.now()}`;

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerId,
        financialAccountId,
        paymentDate: new Date().toISOString(),
        reference: testRef,
        paymentMethod: 'WIRE_TRANSFER',
        totalAmount: paymentAmount,
        currency: 'USD',
        notes: 'Deposit for ocean freight container dispatch'
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.receipt).toBeDefined();

    const receipt = res.body.receipt;
    expect(receipt.receiptNumber).toMatch(/^RCP-\d{4}-\d{4}$/);
    expect(Number(receipt.amount)).toBe(paymentAmount);
    expect(receipt.currency).toBe('USD');
    expect(receipt.status).toBe('ISSUED');
    expect(receipt.receivingAccountMasked).toBe('101502******0472');
    expect(receipt.amountInWords).toContain('Fifteen Thousand US Dollars and Fifty Cents');
    expect(receipt.paymentId).toBe(res.body.id);

    // Verify exactly one receipt is stored in database
    const dbReceipts = await prisma.receipt.findMany({ where: { paymentId: res.body.id } });
    expect(dbReceipts.length).toBe(1);
    expect(dbReceipts[0].receiptNumber).toBe(receipt.receiptNumber);
  });

  it('TC-RCP-03: allows searching and retrieving receipt by ID and query', async () => {
    const listRes = await request(app)
      .get('/api/receipts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThan(0);

    const targetReceipt = listRes.body[0];
    const getRes = await request(app)
      .get(`/api/receipts/${targetReceipt.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.receiptNumber).toBe(targetReceipt.receiptNumber);
    expect(getRes.body.amount).toBe(targetReceipt.amount);
  });

  it('TC-RCP-04: exports complete print/PDF data payload with official company branding', async () => {
    const receipts = await prisma.receipt.findMany({ take: 1 });
    expect(receipts.length).toBeGreaterThan(0);

    const pdfRes = await request(app)
      .get(`/api/receipts/${receipts[0].id}/pdf-data`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.body.company.legalName).toBe('Sky Ariana Ltd');
    expect(pdfRes.body.company.logoUrl).toBe('/sky-ariana-logo.png');
    expect(pdfRes.body.receipt.receiptNumber).toBe(receipts[0].receiptNumber);
    expect(pdfRes.body.receipt.receivingAccountMasked).toBe('101502******0472');
    expect(pdfRes.body.receipt.amountFormatted).toContain('$');
    expect(pdfRes.body.receipt.amountInWords).toBeDefined();
  });

  it('TC-RCP-05: enforces authorized void workflow and records audit event', async () => {
    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber: `RCP-VOID-TEST-${Date.now()}`,
        payerName: 'Temporary Account',
        receivingAccountName: 'Operating Account',
        receivingAccountMasked: '101502******0472',
        amount: 500,
        currency: 'USD',
        purpose: 'Temporary deposit to test voiding',
        status: 'ISSUED'
      }
    });

    const voidRes = await request(app)
      .post(`/api/receipts/${receipt.id}/void`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reason: 'Accidental duplicate entry by clerk' });

    expect(voidRes.status).toBe(200);
    expect(voidRes.body.status).toBe('VOIDED');
    expect(voidRes.body.voidReason).toBe('Accidental duplicate entry by clerk');

    // Verify audit log entry exists
    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        action: 'RECEIPT_VOIDED',
        entityId: receipt.id
      }
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.action).toBe('RECEIPT_VOIDED');
  });

  afterAll(async () => {
    const testReceipts = await prisma.receipt.findMany({
      where: {
        OR: [
          { receiptNumber: { startsWith: 'RCP-VOID-TEST-' } },
          { referenceNumber: { startsWith: 'WIRE-RCP-TEST-' } }
        ]
      }
    });
    const receiptIds = testReceipts.map(r => r.id);
    const payIds = testReceipts.map(r => r.paymentId).filter(Boolean) as string[];

    if (receiptIds.length > 0) {
      await prisma.receipt.deleteMany({ where: { id: { in: receiptIds } } });
    }
    if (payIds.length > 0) {
      await prisma.paymentAllocation.deleteMany({ where: { paymentId: { in: payIds } } });
      await prisma.payment.deleteMany({ where: { id: { in: payIds } } });
    }
  });
});
