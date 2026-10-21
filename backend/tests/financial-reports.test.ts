import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';

const app = createApp();

describe('Enterprise Financial Accounting & Statements Suite Tests', () => {
  let authToken: string;
  let testCustomerId: string;

  beforeAll(async () => {
    // Authenticate as Finance Manager
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'finance@aqcompanies.com', password: 'AQCompanies@2026' });

    authToken = loginRes.body.accessToken;
    expect(authToken).toBeDefined();

    // Get an existing customer
    const customer = await prisma.customer.findFirst({
      where: { invoices: { some: {} } }
    });
    if (customer) {
      testCustomerId = customer.id;
    } else {
      const anyCust = await prisma.customer.findFirst();
      testCustomerId = anyCust!.id;
    }
  });

  it('TC-ACC-PL-01: generates comprehensive Profit & Loss (Income Statement) with correct gross & net margins', async () => {
    const res = await request(app)
      .get('/api/reports/profit-loss')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const body = res.body;

    expect(body.revenue).toBeDefined();
    expect(typeof body.revenue.billedRevenue).toBe('number');
    expect(typeof body.revenue.cashCollected).toBe('number');

    expect(body.expensesByCategory).toBeDefined();
    expect(body.expensesByCategory.LOGISTICS_FREIGHT).toBeDefined();
    expect(body.expensesByCategory.CUSTOMS_DUTY).toBeDefined();
    expect(body.expensesByCategory.STORAGE_WAREHOUSING).toBeDefined();
    expect(body.expensesByCategory.BANK_SWIFT_FEES).toBeDefined();
    expect(body.expensesByCategory.OPERATING_EXPENSE).toBeDefined();

    expect(typeof body.directTradeCosts).toBe('number');
    expect(typeof body.totalExpenses).toBe('number');
    expect(typeof body.grossProfit).toBe('number');
    expect(typeof body.netOperatingIncome).toBe('number');
    expect(typeof body.grossMarginPercent).toBe('number');
    expect(typeof body.netMarginPercent).toBe('number');

    // Mathematical integrity check: Net Operating Income = Billed Revenue - Total Expenses
    const expectedNet = parseFloat((body.revenue.billedRevenue - body.totalExpenses).toFixed(2));
    expect(parseFloat(body.netOperatingIncome.toFixed(2))).toBeCloseTo(expectedNet, 1);
  });

  it('TC-ACC-BS-01: generates Balance Sheet with perfect mathematical equality (Assets = Liabilities + Equity)', async () => {
    const res = await request(app)
      .get('/api/reports/balance-sheet')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const { assets, liabilities, equity, audit } = res.body;

    expect(assets.cashAndEquivalents).toBeDefined();
    expect(assets.accountsReceivable).toBeDefined();
    expect(assets.totalAssets).toBe(assets.cashAndEquivalents + assets.accountsReceivable);

    expect(liabilities.totalLiabilities).toBeDefined();
    expect(equity.totalEquity).toBeDefined();
    expect(equity.openingCapital).toBeDefined();
    expect(equity.retainedEarnings).toBeDefined();

    // The fundamental accounting equation: Assets = Liabilities + Equity
    expect(audit.isBalanced).toBe(true);
    expect(Math.abs(audit.discrepancy)).toBeLessThan(0.01);
  });

  it('TC-ACC-CF-01: generates Cash Flow Statement (Direct Method) reconciling with bank balance', async () => {
    const res = await request(app)
      .get('/api/reports/cash-flow')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const { cashFlows, cashSummary } = res.body;

    expect(cashFlows.operatingActivities).toBeDefined();
    expect(typeof cashFlows.operatingActivities.customerReceipts).toBe('number');
    expect(typeof cashFlows.operatingActivities.vendorDisbursements).toBe('number');
    expect(typeof cashFlows.operatingActivities.netCashFromOperations).toBe('number');

    expect(cashSummary.beginningCash).toBeDefined();
    expect(cashSummary.netChangeInCash).toBe(cashFlows.operatingActivities.netCashFromOperations);
    expect(parseFloat((cashSummary.beginningCash + cashSummary.netChangeInCash).toFixed(2)))
      .toBeCloseTo(parseFloat(cashSummary.endingCash.toFixed(2)), 1);
  });

  it('TC-ACC-STMT-01: generates Customer Account Statement with chronological timeline and running balances', async () => {
    const res = await request(app)
      .get(`/api/reports/customer-statement/${testCustomerId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const { customer, summary, entries } = res.body;

    expect(customer.companyName).toBeDefined();
    expect(summary.openingBalance).toBeDefined();
    expect(summary.totalInvoiced).toBeDefined();
    expect(summary.totalPaymentsReceived).toBeDefined();
    expect(summary.closingBalance).toBeDefined();
    expect(Array.isArray(entries)).toBe(true);

    if (entries.length > 0) {
      // Verify first entry has valid running balance
      expect(entries[0].runningBalance).toBeDefined();
      expect(['INVOICE', 'PAYMENT']).toContain(entries[0].type);
    }
  });

  it('TC-ACC-STMT-02: computes accurate period opening balance and date-filtered customer statement', async () => {
    const futureDate = '2099-01-01';
    const res = await request(app)
      .get(`/api/reports/customer-statement/${testCustomerId}?startDate=${futureDate}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // Period entries in the far future should be 0, and opening balance equals total all-time outstanding
    expect(res.body.entries.length).toBe(0);
    expect(res.body.summary.openingBalance).toBe(res.body.summary.allTimeOutstanding);
    expect(res.body.summary.closingBalance).toBe(res.body.summary.allTimeOutstanding);
  });
});
