import { Router, Response, NextFunction } from 'express';
import { prisma } from '../../prisma.js';
import { toDecimal, calculateLedgerRunningBalances } from '../../utils/decimal.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/dashboard/overview
router.get('/overview', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Ledger Transactions & Running Balance
    const financialAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
    const openingBalance = financialAccount ? financialAccount.openingBalance : 0;

    const allTxs = await prisma.ledgerTransaction.findMany({
      orderBy: [
        { effectiveDate: 'asc' },
        { postedAt: 'asc' },
        { id: 'asc' }
      ]
    });

    const calculatedTxs = calculateLedgerRunningBalances(openingBalance, allTxs.map(t => ({
      id: t.id,
      effectiveDate: t.effectiveDate,
      postedAt: t.postedAt,
      category: t.category,
      debitAmount: t.debitAmount,
      creditAmount: t.creditAmount
    })));

    const currentBalance = calculatedTxs.length > 0
      ? calculatedTxs[calculatedTxs.length - 1].runningBalanceFormatted
      : toDecimal(openingBalance).toFixed(2);

    const totalCredits = allTxs.reduce((sum, t) => sum.plus(toDecimal(t.creditAmount)), toDecimal(0));
    const totalDebits = allTxs.reduce((sum, t) => sum.plus(toDecimal(t.debitAmount)), toDecimal(0));

    // 2. Invoices & Receivables
    const allInvoices = await prisma.invoice.findMany({
      where: { status: { not: 'VOID' } },
      include: { customer: true, paymentAllocations: true }
    });

    const totalInvoiced = allInvoices.reduce((sum, inv) => sum.plus(toDecimal(inv.totalAmount)), toDecimal(0));
    
    // Pending receivables = invoices where paymentStatus != 'PAID'
    const pendingInvoices = allInvoices.filter(inv => inv.paymentStatus !== 'PAID');
    const totalPending = pendingInvoices.reduce((sum, inv) => {
      const invTotal = toDecimal(inv.totalAmount);
      const paid = inv.paymentAllocations.reduce((pSum, a) => pSum.plus(toDecimal(a.amount)), toDecimal(0));
      return sum.plus(invTotal.minus(paid));
    }, toDecimal(0));

    // 3. Shipments
    const allShipments = await prisma.shipment.findMany();
    const activeShipments = allShipments.filter(s => s.status === 'IN_TRANSIT' || s.status === 'AT_ORIGIN_PORT' || s.status === 'BOOKED');

    // 4. Latest 5 transactions
    const latestTransactions = calculatedTxs.slice(-5).reverse();

    // 5. Cash Flow metrics
    const cashFlow = {
      totalIncoming: totalCredits.toFixed(2),
      totalOutgoing: totalDebits.toFixed(2),
      netOperatingCashFlow: totalCredits.minus(totalDebits).toFixed(2)
    };

    res.json({
      metrics: {
        availableBalance: currentBalance,
        totalCredits: totalCredits.toFixed(2),
        totalDebits: totalDebits.toFixed(2),
        totalInvoiced: totalInvoiced.toFixed(2),
        pendingReceivables: totalPending.toFixed(2),
        activeShipmentsCount: activeShipments.length,
        totalInvoicesCount: allInvoices.length,
        unreconciledTxCount: allTxs.filter(t => t.reconciliationStatus === 'UNRECONCILED').length
      },
      cashFlow,
      latestTransactions,
      recentShipments: activeShipments.slice(0, 5)
    });
  } catch (err) {
    next(err);
  }
});

export default router;
