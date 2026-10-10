import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { en } from '../../frontend/src/locales/en.js';
import { ps } from '../../frontend/src/locales/ps.js';

const app = createApp();

describe('Proforma Invoice Visibility, Persistence & Localization E2E Tests', () => {
  let authToken: string;
  let customerId: string;

  beforeAll(async () => {
    // 1. Authenticate as Finance Manager
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'finance@aqcompanies.com', password: 'AQCompanies@2026' });

    authToken = loginRes.body.accessToken;
    expect(authToken).toBeDefined();

    // 2. Fetch or create test customer
    let cust = await prisma.customer.findFirst();
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          companyName: 'Sky Ariana General Trading LLC',
          country: 'United Arab Emirates'
        }
      });
    }
    customerId = cust.id;
  });

  it('TC-INV-VIS-01: Proforma invoice retrieval returns all existing invoices even when frontend sends status=undefined or empty search', async () => {
    // Test the exact bug where ?search=&status=undefined caused 0 results
    const resUndefined = await request(app)
      .get('/api/invoices?search=&status=undefined')
      .set('Authorization', `Bearer ${authToken}`);

    expect(resUndefined.status).toBe(200);
    expect(Array.isArray(resUndefined.body)).toBe(true);
    expect(resUndefined.body.length).toBeGreaterThan(0);
    const countWithUndefinedParam = resUndefined.body.length;

    // Test without query parameters
    const resAll = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${authToken}`);

    expect(resAll.status).toBe(200);
    expect(Array.isArray(resAll.body)).toBe(true);
    // Both calls must return identical records
    expect(resAll.body.length).toBe(countWithUndefinedParam);
  });

  it('TC-INV-VIS-02: Query filtering by status accurately filters records without suppression', async () => {
    const resIssued = await request(app)
      .get('/api/invoices?status=ISSUED')
      .set('Authorization', `Bearer ${authToken}`);

    expect(resIssued.status).toBe(200);
    expect(Array.isArray(resIssued.body)).toBe(true);
    resIssued.body.forEach((inv: any) => {
      expect(inv.status).toBe('ISSUED');
    });

    const resDraft = await request(app)
      .get('/api/invoices?status=DRAFT')
      .set('Authorization', `Bearer ${authToken}`);

    expect(resDraft.status).toBe(200);
    expect(Array.isArray(resDraft.body)).toBe(true);
    resDraft.body.forEach((inv: any) => {
      expect(inv.status).toBe('DRAFT');
    });
  });

  it('TC-INV-CREAT-01: Atomically creates a new proforma invoice with correct server-side calculations', async () => {
    const uniqueRef = `TEST-PI-${Date.now()}`;
    const payload = {
      customerId,
      issueDate: new Date().toISOString(),
      sourceInvoiceRef: uniqueRef,
      paymentTerms: '100% CAD against copy of original shipping documents',
      lines: [
        {
          description: 'Premium Kandahar Pomegranate Extract - Grade A',
          quantity: 5000,
          unitOfMeasure: 'KG',
          unitPrice: 4.50
        },
        {
          description: 'Herat Organic Saffron Threads',
          quantity: 50,
          unitOfMeasure: 'KG',
          unitPrice: 1200.00
        }
      ]
    };

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.invoiceNumber).toMatch(/^PI-\d{4}-/);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.paymentStatus).toBe('UNPAID');

    // Expected Line 1: 5000 * 4.50 = 22,500.00
    // Expected Line 2: 50 * 1200.00 = 60,000.00
    // Grand Total: 82,500.00
    expect(Number(res.body.subtotal)).toBeCloseTo(82500.00, 2);
    expect(Number(res.body.totalAmount)).toBeCloseTo(82500.00, 2);
    expect(res.body.lines.length).toBe(2);
  });

  it('TC-INV-CREAT-02: Newly created invoice persists to database and is immediately returned in listing', async () => {
    const uniqueRef = `PERSIST-REF-${Date.now()}`;
    const createRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerId,
        issueDate: new Date().toISOString(),
        sourceInvoiceRef: uniqueRef,
        lines: [
          {
            description: 'Mazari Mung Beans',
            quantity: 10000,
            unitOfMeasure: 'KG',
            unitPrice: 1.15
          }
        ]
      });

    expect(createRes.status).toBe(201);
    const createdId = createRes.body.id;
    const createdInvoiceNumber = createRes.body.invoiceNumber;

    // Verify retrieval by ID
    const getRes = await request(app)
      .get(`/api/invoices/${createdId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.invoiceNumber).toBe(createdInvoiceNumber);
    expect(getRes.body.sourceInvoiceRef).toBe(uniqueRef);

    // Verify presence in listing endpoint
    const listRes = await request(app)
      .get(`/api/invoices?search=${createdInvoiceNumber}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    const found = listRes.body.find((inv: any) => inv.id === createdId);
    expect(found).toBeDefined();
    expect(found.invoiceNumber).toBe(createdInvoiceNumber);
  });

  it('TC-I18N-01: Verifies complete translation dictionary parity between English and Pashto', () => {
    const enKeys = Object.keys(en);
    const psKeys = Object.keys(ps);

    // Ensure all English keys exist in Pashto
    for (const key of enKeys) {
      expect(ps).toHaveProperty(key);
      const val = (ps as any)[key];
      expect(typeof val).toBe('string');
      expect(val.trim().length).toBeGreaterThan(0);
    }

    // Ensure all Pashto keys exist in English
    for (const key of psKeys) {
      expect(en).toHaveProperty(key);
    }

    // Parity count check
    expect(enKeys.length).toBe(psKeys.length);
  });
});
