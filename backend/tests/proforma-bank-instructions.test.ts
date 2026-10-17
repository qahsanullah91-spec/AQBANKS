import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';

const app = createApp();

describe('Proforma Invoice Full USD Bank / Payment Instructions Tests', () => {
  let authToken: string;
  let customerId: string;
  let testInvoiceId: string;

  beforeAll(async () => {
    // 1. Authenticate as Finance Manager
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'finance@aqcompanies.com', password: 'AQCompanies@2026' });

    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.accessToken;

    // 2. Resolve or create customer
    let cust = await prisma.customer.findFirst();
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          companyName: 'G.T INDIA PVT LTD',
          country: 'India',
          addressLine1: 'Khari Baoli, Delhi',
          email: 'imports@gtindia.com'
        }
      });
    }
    customerId = cust.id;
  });

  it('TC-PI-BANK-01: Creates a draft invoice with active remittance profile', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerId,
        issueDate: '2026-10-15',
        paymentTerms: '100% Advance Payment',
        lines: [
          {
            description: 'Black Raisins (Best) - 1,385 CTNS',
            quantity: 22160,
            unitOfMeasure: 'KG',
            unitPrice: 3.58
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    testInvoiceId = res.body.id;
  });

  it('TC-PI-BANK-02: Returns complete and exact USD bank instructions in /pdf-data', async () => {
    const res = await request(app)
      .get(`/api/invoices/${testInvoiceId}/pdf-data`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const p = res.body.paymentInstructions;
    expect(p).toBeDefined();

    // Verify Title
    expect(p.title).toBe('BANK / PAYMENT INSTRUCTIONS - USD');

    // Verify Beneficiary / Bank
    expect(p.beneficiary.name).toBe('SKY ARIANA LTD');
    expect(p.beneficiary.accountNumber).toBe('101502USD2940472');
    expect(p.beneficiary.bankName).toBe('AFGHAN UNITED BANK');
    expect(p.beneficiary.bankAddress).toContain('AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul');
    expect(p.beneficiary.swiftCode).toBe('AFGUAFKAXXX');
    expect(p.beneficiary.mt103Note).toContain('field 59A');
    expect(p.beneficiary.mt103Note).toContain('field 57A');

    // Verify International USD Payment Routing
    expect(p.internationalRouting.correspondentBank).toBe('AL SALAM BANK BAHRAIN');
    expect(p.internationalRouting.swiftCode).toBe('ALSABHBMXXX');
    expect(p.internationalRouting.aubAccountWithCorrespondent).toBe('BH61ALSA00500951200102');
    expect(p.internationalRouting.intermediaryAccount).toBe('400758954');
    expect(p.internationalRouting.location).toBe('Sanabis, Bahrain');
    expect(p.internationalRouting.intermediaryBank).toBe('JPMorgan Chase Bank, New York');
    expect(p.internationalRouting.intermediarySwift).toBe('CHASUS33');
    expect(p.internationalRouting.mt103Note).toContain('ALSABHBM in field 56A');
    expect(p.internationalRouting.mt103Note).toContain('field 54A');

    // Verify Local USD Correspondent
    expect(p.localCorrespondent.bank).toBe('(DAB) DA AFGHANISTAN BANK');
    expect(p.localCorrespondent.swiftCode).toBe('AFGBAFKA');
    expect(p.localCorrespondent.accountNumber).toBe('3000205027231');
    expect(p.localCorrespondent.location).toBe('Ibni-sina Watt, Kabul');

    // Verify Important USD Payment Note
    expect(p.importantPaymentNote.title).toBe('IMPORTANT USD PAYMENT NOTE');
    expect(p.importantPaymentNote.text).toContain('CORRESPONDENT BANK: AL SALAM BANK BAHRAIN');
    expect(p.importantPaymentNote.text).toContain('SWIFT CODE: ALSABHBMXXX');
    expect(p.importantPaymentNote.text).toContain('A/C NO. WITH INTERMEDIARY BANK: 400758954');
    expect(p.importantPaymentNote.text).toContain('LOCATION: SANABIS, BAHRAIN');
    expect(p.importantPaymentNote.text).toContain('Field 56A');
  });

  it('TC-PI-BANK-03: Freezes full payment instructions in immutable snapshot upon issuing', async () => {
    const issueRes = await request(app)
      .post(`/api/invoices/${testInvoiceId}/issue`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(issueRes.status).toBe(200);
    expect(issueRes.body.status).toBe('ISSUED');

    // Verify snapshot in database
    const snapshotRecord = await prisma.invoiceBankSnapshot.findUnique({
      where: { invoiceId: testInvoiceId }
    });

    expect(snapshotRecord).toBeDefined();
    const frozen = JSON.parse(snapshotRecord!.snapshotJson);

    expect(frozen.title).toBe('BANK / PAYMENT INSTRUCTIONS - USD');
    expect(frozen.beneficiary.name).toBe('SKY ARIANA LTD');
    expect(frozen.beneficiary.accountNumber).toBe('101502USD2940472');
    expect(frozen.beneficiary.bankName).toBe('AFGHAN UNITED BANK');
    expect(frozen.beneficiary.address).toContain('AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul');
    expect(frozen.beneficiary.swiftBic).toBe('AFGUAFKAXXX');
    expect(frozen.internationalRouting.correspondentBank).toBe('AL SALAM BANK BAHRAIN');
    expect(frozen.internationalRouting.swiftCode).toBe('ALSABHBMXXX');
    expect(frozen.internationalRouting.aubAccountWithCorrespondent).toBe('BH61ALSA00500951200102');
    expect(frozen.internationalRouting.intermediaryAccount).toBe('400758954');
    expect(frozen.internationalRouting.location).toBe('Sanabis, Bahrain');
    expect(frozen.internationalRouting.intermediaryBank).toBe('JPMorgan Chase Bank, New York');
    expect(frozen.internationalRouting.intermediarySwift).toBe('CHASUS33');
    expect(frozen.localCorrespondent.bank).toBe('(DAB) DA AFGHANISTAN BANK');
    expect(frozen.localCorrespondent.accountNumber).toBe('3000205027231');
    expect(frozen.importantPaymentNote.text).toContain('ALSABHBM');

    // Verify /pdf-data reflects frozen snapshot flag
    const pdfRes = await request(app)
      .get(`/api/invoices/${testInvoiceId}/pdf-data`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.body.paymentInstructions.isSnapshot).toBe(true);
  });

  afterAll(async () => {
    if (testInvoiceId) {
      await prisma.invoiceBankSnapshot.deleteMany({ where: { invoiceId: testInvoiceId } });
      await prisma.invoiceSnapshot.deleteMany({ where: { invoiceId: testInvoiceId } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: testInvoiceId } });
      await prisma.invoice.deleteMany({ where: { id: testInvoiceId } });
    }
  });
});
