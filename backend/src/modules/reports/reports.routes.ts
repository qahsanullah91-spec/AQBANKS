import { Router, Response, NextFunction } from 'express';
import { prisma } from '../../prisma.js';
import { toDecimal, calculateLedgerRunningBalances } from '../../utils/decimal.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';

const router = Router();

// Helper to classify an expense into standard chart of accounts
export function classifyExpense(tx: { description?: string | null; notes?: string | null }): string {
  if (tx.notes) {
    const match = tx.notes.match(/\[([A-Z_]+)\]/);
    if (match && [
      'LOGISTICS_FREIGHT',
      'CUSTOMS_DUTY',
      'STORAGE_WAREHOUSING',
      'PACKAGING_MATERIALS',
      'BANK_SWIFT_FEES',
      'COMMISSION_BROKERAGE',
      'OPERATING_EXPENSE'
    ].includes(match[1])) {
      return match[1];
    }
  }

  const desc = (tx.description || '').toLowerCase();
  if (desc.includes('freight') || desc.includes('shipping') || desc.includes('carrier') || desc.includes('vessel') || desc.includes('cargo') || desc.includes('maersk') || desc.includes('transport') || desc.includes('bl fee')) {
    return 'LOGISTICS_FREIGHT';
  }
  if (desc.includes('custom') || desc.includes('duty') || desc.includes('port') || desc.includes('clearance') || desc.includes('tariff') || desc.includes('border') || desc.includes('terminal')) {
    return 'CUSTOMS_DUTY';
  }
  if (desc.includes('storage') || desc.includes('warehouse') || desc.includes('cold') || desc.includes('demurrage') || desc.includes('detention')) {
    return 'STORAGE_WAREHOUSING';
  }
  if (desc.includes('pack') || desc.includes('carton') || desc.includes('box') || desc.includes('pallet') || desc.includes('wrapping') || desc.includes('label')) {
    return 'PACKAGING_MATERIALS';
  }
  if (desc.includes('swift') || desc.includes('wire fee') || desc.includes('bank fee') || desc.includes('correspondent') || desc.includes('charge')) {
    return 'BANK_SWIFT_FEES';
  }
  if (desc.includes('commission') || desc.includes('broker') || desc.includes('agent') || desc.includes('finder')) {
    return 'COMMISSION_BROKERAGE';
  }

  return 'OPERATING_EXPENSE';
}

const endOfDay = (dStr: string): Date => {
  const d = new Date(dStr);
  d.setHours(23, 59, 59, 999);
  return d;
};

// GET /api/reports/receivables-aging (Restricted to Finance Manager, Auditor & Admin)
router.get('/receivables-aging', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        status: 'ISSUED'
      },
      include: { customer: true, paymentAllocations: true }
    });

    const now = new Date();
    const buckets = {
      current_0_30: toDecimal(0),
      aging_31_60: toDecimal(0),
      aging_61_90: toDecimal(0),
      aging_over_90: toDecimal(0),
      totalOutstanding: toDecimal(0)
    };

    const details: any[] = [];

    for (const inv of invoices) {
      const invTotal = toDecimal(inv.totalAmount);
      const paid = inv.paymentAllocations.reduce(
        (sum, a) => sum.plus(toDecimal(a.amount)).plus(toDecimal(a.swiftBankFee || 0)),
        toDecimal(0)
      );
      const outstanding = invTotal.minus(paid);

      if (outstanding.lessThanOrEqualTo(0)) continue;

      const days = Math.floor((now.getTime() - new Date(inv.issueDate).getTime()) / (1000 * 60 * 60 * 24));

      let bucket = 'current_0_30';
      if (days > 90) bucket = 'aging_over_90';
      else if (days > 60) bucket = 'aging_61_90';
      else if (days > 30) bucket = 'aging_31_60';

      (buckets as any)[bucket] = (buckets as any)[bucket].plus(outstanding);
      buckets.totalOutstanding = buckets.totalOutstanding.plus(outstanding);

      details.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer.companyName,
        issueDate: inv.issueDate,
        daysOld: days,
        bucket,
        totalAmount: invTotal.toFixed(2),
        paidAmount: paid.toFixed(2),
        outstandingAmount: outstanding.toFixed(2)
      });
    }

    res.json({
      summary: {
        current_0_30: buckets.current_0_30.toFixed(2),
        aging_31_60: buckets.aging_31_60.toFixed(2),
        aging_61_90: buckets.aging_61_90.toFixed(2),
        aging_over_90: buckets.aging_over_90.toFixed(2),
        totalOutstanding: buckets.totalOutstanding.toFixed(2)
      },
      details
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/customer-statement/:customerId (Date-ranged, opening balance, running balances, official printable)
router.get('/customer-statement/:customerId', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const customer = await prisma.customer.findUnique({
      where: { id: req.params.customerId },
      include: {
        invoices: {
          where: { status: 'ISSUED' },
          include: { paymentAllocations: true },
          orderBy: { issueDate: 'asc' }
        },
        payments: {
          include: { allocations: true },
          orderBy: { paymentDate: 'asc' }
        }
      }
    });

    if (!customer) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found' });
      return;
    }

    const start = startDate ? new Date(String(startDate)) : null;
    const end = endDate ? endOfDay(String(endDate)) : null;

    // Calculate Prior / Opening Balance prior to start date
    let priorInvoiced = toDecimal(0);
    let priorPaid = toDecimal(0);

    for (const inv of customer.invoices) {
      if (start && new Date(inv.issueDate) < start) {
        priorInvoiced = priorInvoiced.plus(toDecimal(inv.totalAmount));
      }
    }

    for (const pmt of customer.payments) {
      if (start && new Date(pmt.paymentDate) < start) {
        priorPaid = priorPaid.plus(toDecimal(pmt.totalAmount));
      }
    }

    const openingBalance = priorInvoiced.minus(priorPaid);

    // Filter transactions within [start, end]
    const periodInvoices = customer.invoices.filter(inv => {
      const d = new Date(inv.issueDate);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

    const periodPayments = customer.payments.filter(pmt => {
      const d = new Date(pmt.paymentDate);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

    // Merge into chronological ledger timeline
    interface StatementEntry {
      id: string;
      date: Date;
      type: 'INVOICE' | 'PAYMENT';
      reference: string;
      description: string;
      debit: number;
      credit: number;
      swiftFee: number;
      runningBalance: number;
      status?: string;
      paymentMethod?: string;
    }

    const rawEntries: StatementEntry[] = [];

    for (const inv of periodInvoices) {
      const amount = toDecimal(inv.totalAmount).toNumber();
      rawEntries.push({
        id: inv.id,
        date: new Date(inv.issueDate),
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        description: `Commercial Proforma Invoice - ${inv.invoiceNumber}`,
        debit: amount,
        credit: 0,
        swiftFee: 0,
        runningBalance: 0,
        status: inv.paymentStatus
      });
    }

    for (const pmt of periodPayments) {
      const swiftFee = pmt.allocations.reduce((sum, a) => sum + Number(a.swiftBankFee || 0), 0);
      const gross = toDecimal(pmt.totalAmount).toNumber();
      rawEntries.push({
        id: pmt.id,
        date: new Date(pmt.paymentDate),
        type: 'PAYMENT',
        reference: pmt.reference || `PMT-${pmt.id.slice(0, 8).toUpperCase()}`,
        description: pmt.notes || `Wire Transfer Settlement`,
        debit: 0,
        credit: gross,
        swiftFee,
        runningBalance: 0,
        paymentMethod: pmt.paymentMethod
      });
    }

    // Sort deterministically: date ASC, then INVOICE before PAYMENT on same date
    rawEntries.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      if (a.type === 'INVOICE' && b.type === 'PAYMENT') return -1;
      if (a.type === 'PAYMENT' && b.type === 'INVOICE') return 1;
      return a.id.localeCompare(b.id);
    });

    // Compute line-by-line running balance
    let curBal = openingBalance;
    const entries = rawEntries.map(entry => {
      curBal = curBal.plus(toDecimal(entry.debit)).minus(toDecimal(entry.credit));
      return {
        ...entry,
        runningBalance: curBal.toNumber()
      };
    });

    const closingBalance = curBal;

    const totalInvoicedPeriod = periodInvoices.reduce((sum, inv) => sum.plus(toDecimal(inv.totalAmount)), toDecimal(0));
    const totalPaidPeriod = periodPayments.reduce((sum, p) => sum.plus(toDecimal(p.totalAmount)), toDecimal(0));
    const allTimeInvoiced = customer.invoices.reduce((sum, inv) => sum.plus(toDecimal(inv.totalAmount)), toDecimal(0));
    const allTimePaid = customer.payments.reduce((sum, p) => sum.plus(toDecimal(p.totalAmount)), toDecimal(0));

    res.json({
      customer: {
        id: customer.id,
        companyName: customer.companyName,
        contactPerson: customer.contactPerson,
        email: customer.email,
        phone: customer.phone,
        country: customer.country,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2
      },
      period: {
        startDate: startDate ? String(startDate) : null,
        endDate: endDate ? String(endDate) : null,
        isCustom: Boolean(startDate || endDate)
      },
      summary: {
        openingBalance: openingBalance.toNumber(),
        totalInvoiced: totalInvoicedPeriod.toNumber(),
        totalPaymentsReceived: totalPaidPeriod.toNumber(),
        netPeriodChange: totalInvoicedPeriod.minus(totalPaidPeriod).toNumber(),
        closingBalance: closingBalance.toNumber(),
        allTimeInvoiced: allTimeInvoiced.toNumber(),
        allTimePaid: allTimePaid.toNumber(),
        allTimeOutstanding: allTimeInvoiced.minus(allTimePaid).toNumber()
      },
      entries,
      invoices: customer.invoices,
      payments: customer.payments
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/profit-loss (Income Statement / P&L)
router.get('/profit-loss', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(String(startDate)) : null;
    const end = endDate ? endOfDay(String(endDate)) : null;

    // 1. Commercial Sales Revenue (Billed)
    const invoiceWhere: any = { status: 'ISSUED' };
    if (start || end) {
      invoiceWhere.issueDate = {};
      if (start) invoiceWhere.issueDate.gte = start;
      if (end) invoiceWhere.issueDate.lte = end;
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: { customer: true, lines: true }
    });

    const billedRevenue = invoices.reduce((sum, inv) => sum.plus(toDecimal(inv.totalAmount)), toDecimal(0));

    // Realized Cash Collected in period
    const paymentWhere: any = {};
    if (start || end) {
      paymentWhere.paymentDate = {};
      if (start) paymentWhere.paymentDate.gte = start;
      if (end) paymentWhere.paymentDate.lte = end;
    }
    const payments = await prisma.payment.findMany({
      where: paymentWhere,
      include: { allocations: true, customer: true }
    });
    const cashCollected = payments.reduce((sum, p) => sum.plus(toDecimal(p.totalAmount)), toDecimal(0));

    // 2. Ledger Debits (Expenses & Disbursements)
    const ledgerWhere: any = { category: 'DEBIT' };
    if (start || end) {
      ledgerWhere.effectiveDate = {};
      if (start) ledgerWhere.effectiveDate.gte = start;
      if (end) ledgerWhere.effectiveDate.lte = end;
    }

    const debitTxs = await prisma.ledgerTransaction.findMany({
      where: ledgerWhere,
      orderBy: { effectiveDate: 'asc' }
    });

    // Subcategorize debits into standard Chart of Accounts
    const expensesByCategory: Record<string, { label: string; amount: number; count: number; transactions: any[] }> = {
      LOGISTICS_FREIGHT: { label: 'Freight & Shipping Operations', amount: 0, count: 0, transactions: [] },
      CUSTOMS_DUTY: { label: 'Customs Clearance, Port & Terminal Duties', amount: 0, count: 0, transactions: [] },
      STORAGE_WAREHOUSING: { label: 'Warehousing, Cold Storage & Demurrage', amount: 0, count: 0, transactions: [] },
      PACKAGING_MATERIALS: { label: 'Packaging, Corrugated Cartons & Materials', amount: 0, count: 0, transactions: [] },
      BANK_SWIFT_FEES: { label: 'Intermediary SWIFT & Banking Deductions', amount: 0, count: 0, transactions: [] },
      COMMISSION_BROKERAGE: { label: 'Brokerage & Agent Trade Commissions', amount: 0, count: 0, transactions: [] },
      OPERATING_EXPENSE: { label: 'General & Administrative Operations', amount: 0, count: 0, transactions: [] }
    };

    for (const tx of debitTxs) {
      const cat = classifyExpense(tx);
      const amt = toDecimal(tx.debitAmount).toNumber();
      if (!expensesByCategory[cat]) {
        expensesByCategory[cat] = { label: cat, amount: 0, count: 0, transactions: [] };
      }
      expensesByCategory[cat].amount = toDecimal(expensesByCategory[cat].amount).plus(amt).toNumber();
      expensesByCategory[cat].count += 1;
      expensesByCategory[cat].transactions.push({
        id: tx.id,
        date: tx.effectiveDate,
        reference: tx.reference,
        description: tx.description,
        amount: amt
      });
    }

    // Add SWIFT fees deducted from customer payments in this period
    let totalSwiftFeeDeducted = toDecimal(0);
    for (const p of payments) {
      const feeSum = p.allocations.reduce((sum, a) => sum.plus(toDecimal(a.swiftBankFee || 0)), toDecimal(0));
      totalSwiftFeeDeducted = totalSwiftFeeDeducted.plus(feeSum);
    }
    if (totalSwiftFeeDeducted.gt(0)) {
      expensesByCategory.BANK_SWIFT_FEES.amount = toDecimal(expensesByCategory.BANK_SWIFT_FEES.amount).plus(totalSwiftFeeDeducted).toNumber();
      expensesByCategory.BANK_SWIFT_FEES.count += payments.filter(p => p.allocations.some(a => Number(a.swiftBankFee) > 0)).length;
    }

    // Cost of Goods & Logistics (COGS/Direct Trade Costs)
    const directTradeCosts = toDecimal(expensesByCategory.LOGISTICS_FREIGHT.amount)
      .plus(toDecimal(expensesByCategory.CUSTOMS_DUTY.amount))
      .plus(toDecimal(expensesByCategory.STORAGE_WAREHOUSING.amount))
      .plus(toDecimal(expensesByCategory.PACKAGING_MATERIALS.amount))
      .plus(toDecimal(expensesByCategory.COMMISSION_BROKERAGE.amount));

    // Total Operating Expenses
    const totalExpenses = Object.values(expensesByCategory).reduce((sum, item) => sum.plus(toDecimal(item.amount)), toDecimal(0));

    // Gross Profit = Billed Revenue - Direct Trade Costs
    const grossProfit = billedRevenue.minus(directTradeCosts);
    const grossMarginPercent = billedRevenue.gt(0) ? grossProfit.dividedBy(billedRevenue).times(100).toNumber() : 0;

    // Net Operating Income / Profit = Billed Revenue - Total Expenses
    const netOperatingIncome = billedRevenue.minus(totalExpenses);
    const netMarginPercent = billedRevenue.gt(0) ? netOperatingIncome.dividedBy(billedRevenue).times(100).toNumber() : 0;

    res.json({
      period: {
        startDate: startDate ? String(startDate) : null,
        endDate: endDate ? String(endDate) : null
      },
      revenue: {
        billedRevenue: billedRevenue.toNumber(),
        cashCollected: cashCollected.toNumber(),
        invoiceCount: invoices.length,
        invoices: invoices.map(i => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          customerName: i.customer.companyName,
          date: i.issueDate,
          totalAmount: Number(i.totalAmount),
          status: i.paymentStatus
        }))
      },
      directTradeCosts: directTradeCosts.toNumber(),
      grossProfit: grossProfit.toNumber(),
      grossMarginPercent: parseFloat(grossMarginPercent.toFixed(2)),
      expensesByCategory,
      totalExpenses: totalExpenses.toNumber(),
      netOperatingIncome: netOperatingIncome.toNumber(),
      netMarginPercent: parseFloat(netMarginPercent.toFixed(2))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/balance-sheet (Balance Sheet & Trial Balance)
router.get('/balance-sheet', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { asOfDate } = req.query;
    const asOf = asOfDate ? endOfDay(String(asOfDate)) : new Date();

    const finAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
    const openingCapital = finAccount ? toDecimal(finAccount.openingBalance) : toDecimal(0);

    // 1. Liquid Bank Cash Position as of date
    const allTxs = await prisma.ledgerTransaction.findMany({
      where: { effectiveDate: { lte: asOf } },
      orderBy: [{ effectiveDate: 'asc' }, { postedAt: 'asc' }, { id: 'asc' }]
    });

    const calculated = calculateLedgerRunningBalances(openingCapital, allTxs);
    const cashAndEquivalents = calculated.length > 0
      ? calculated[calculated.length - 1].runningBalance
      : openingCapital;

    // 2. Trade Accounts Receivable (A/R) as of date
    const invoicesAsOf = await prisma.invoice.findMany({
      where: {
        status: 'ISSUED',
        issueDate: { lte: asOf }
      },
      include: {
        paymentAllocations: {
          include: { payment: true }
        },
        customer: true
      }
    });

    let totalAccountsReceivable = toDecimal(0);
    const openInvoicesList: any[] = [];

    for (const inv of invoicesAsOf) {
      const invTotal = toDecimal(inv.totalAmount);
      // Only count allocations paid on or before asOfDate
      const paidAsOf = inv.paymentAllocations.reduce((sum, a) => {
        if (new Date(a.payment.paymentDate) <= asOf) {
          return sum.plus(toDecimal(a.amount)).plus(toDecimal(a.swiftBankFee || 0));
        }
        return sum;
      }, toDecimal(0));

      const outstanding = invTotal.minus(paidAsOf);
      if (outstanding.gt(0)) {
        totalAccountsReceivable = totalAccountsReceivable.plus(outstanding);
        openInvoicesList.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customer.companyName,
          issueDate: inv.issueDate,
          totalAmount: invTotal.toNumber(),
          paidAsOf: paidAsOf.toNumber(),
          outstanding: outstanding.toNumber()
        });
      }
    }

    // Total Assets = Cash + A/R
    const totalAssets = cashAndEquivalents.plus(totalAccountsReceivable);

    // 3. Current Liabilities (Unallocated Customer Remittances & Accruals)
    const paymentsAsOf = await prisma.payment.findMany({
      where: { paymentDate: { lte: asOf } },
      include: { allocations: true, customer: true }
    });

    let unallocatedAdvances = toDecimal(0);
    for (const p of paymentsAsOf) {
      const allocated = p.allocations.reduce((sum, a) => sum.plus(toDecimal(a.amount)), toDecimal(0));
      const unalloc = toDecimal(p.totalAmount).minus(allocated);
      if (unalloc.gt(0)) {
        unallocatedAdvances = unallocatedAdvances.plus(unalloc);
      }
    }

    const totalLiabilities = unallocatedAdvances;

    // 4. Equity
    // Retained Earnings = Total Assets - Total Liabilities - Opening Capital
    const retainedEarnings = totalAssets.minus(totalLiabilities).minus(openingCapital);
    const totalEquity = openingCapital.plus(retainedEarnings);

    // Balance check: Total Assets === Total Liabilities + Total Equity
    const balanceCheckDifference = totalAssets.minus(totalLiabilities.plus(totalEquity));
    const isBalanced = balanceCheckDifference.abs().lessThan(0.01);

    res.json({
      asOfDate: asOf.toISOString(),
      assets: {
        cashAndEquivalents: cashAndEquivalents.toNumber(),
        bankAccountName: 'Afghan United Bank Operating Account (USD)',
        accountNumberMasked: '101502******0472',
        accountsReceivable: totalAccountsReceivable.toNumber(),
        openInvoiceCount: openInvoicesList.length,
        totalAssets: totalAssets.toNumber(),
        openInvoices: openInvoicesList
      },
      liabilities: {
        unallocatedCustomerAdvances: unallocatedAdvances.toNumber(),
        totalLiabilities: totalLiabilities.toNumber()
      },
      equity: {
        openingCapital: openingCapital.toNumber(),
        retainedEarnings: retainedEarnings.toNumber(),
        totalEquity: totalEquity.toNumber()
      },
      audit: {
        isBalanced,
        discrepancy: balanceCheckDifference.toNumber()
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/cash-flow (Statement of Cash Flows - Direct Method)
router.get('/cash-flow', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(String(startDate)) : null;
    const end = endDate ? endOfDay(String(endDate)) : null;

    const finAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
    const openingBalance = finAccount ? toDecimal(finAccount.openingBalance) : toDecimal(0);

    // Calculate beginning cash at startDate
    let beginningCash = openingBalance;
    if (start) {
      const priorTxs = await prisma.ledgerTransaction.findMany({
        where: { effectiveDate: { lt: start } },
        orderBy: [{ effectiveDate: 'asc' }, { postedAt: 'asc' }, { id: 'asc' }]
      });
      const priorCalculated = calculateLedgerRunningBalances(openingBalance, priorTxs);
      if (priorCalculated.length > 0) {
        beginningCash = priorCalculated[priorCalculated.length - 1].runningBalance;
      }
    }

    // Transactions within period
    const txWhere: any = {};
    if (start || end) {
      txWhere.effectiveDate = {};
      if (start) txWhere.effectiveDate.gte = start;
      if (end) txWhere.effectiveDate.lte = end;
    }

    const periodTxs = await prisma.ledgerTransaction.findMany({
      where: txWhere,
      orderBy: { effectiveDate: 'asc' }
    });

    let customerInflows = toDecimal(0);
    let operatingOutflows = toDecimal(0);
    const outflowBreakdown: Record<string, number> = {};

    for (const tx of periodTxs) {
      if (tx.category === 'CREDIT') {
        customerInflows = customerInflows.plus(toDecimal(tx.creditAmount));
      } else if (tx.category === 'DEBIT') {
        const amt = toDecimal(tx.debitAmount).toNumber();
        operatingOutflows = operatingOutflows.plus(amt);
        const cat = classifyExpense(tx);
        outflowBreakdown[cat] = toDecimal(outflowBreakdown[cat] || 0).plus(amt).toNumber();
      }
    }

    // SWIFT fees deducted during this period
    const paymentWhere: any = {};
    if (start || end) {
      paymentWhere.paymentDate = {};
      if (start) paymentWhere.paymentDate.gte = start;
      if (end) paymentWhere.paymentDate.lte = end;
    }
    const periodPayments = await prisma.payment.findMany({
      where: paymentWhere,
      include: { allocations: true }
    });
    let swiftFeesPaid = toDecimal(0);
    for (const p of periodPayments) {
      for (const a of p.allocations) {
        swiftFeesPaid = swiftFeesPaid.plus(toDecimal(a.swiftBankFee || 0));
      }
    }

    const netOperatingCashFlow = customerInflows.minus(operatingOutflows);
    const endingCash = beginningCash.plus(netOperatingCashFlow);

    res.json({
      period: {
        startDate: startDate ? String(startDate) : null,
        endDate: endDate ? String(endDate) : null
      },
      cashFlows: {
        operatingActivities: {
          customerReceipts: customerInflows.toNumber(),
          vendorDisbursements: operatingOutflows.toNumber(),
          disbursementsByCategory: outflowBreakdown,
          swiftFeesTracked: swiftFeesPaid.toNumber(),
          netCashFromOperations: netOperatingCashFlow.toNumber()
        }
      },
      cashSummary: {
        beginningCash: beginningCash.toNumber(),
        netChangeInCash: netOperatingCashFlow.toNumber(),
        endingCash: endingCash.toNumber()
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
