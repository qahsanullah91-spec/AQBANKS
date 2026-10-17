import { Router, Response, NextFunction } from 'express';
import { prisma } from '../../prisma.js';
import { toDecimal } from '../../utils/decimal.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';

const router = Router();

// GET /api/reports/receivables-aging (Restricted to Finance Manager, Auditor & Admin)
router.get('/receivables-aging', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
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

// GET /api/reports/customer-statement/:customerId (Restricted to Finance Manager, Auditor & Admin)
router.get('/customer-statement/:customerId', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.customerId },
      include: {
        invoices: {
          where: { status: 'ISSUED' },
          include: { paymentAllocations: true },
          orderBy: { issueDate: 'asc' }
        },
        payments: {
          orderBy: { paymentDate: 'asc' }
        }
      }
    });

    if (!customer) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found' });
      return;
    }

    const totalInvoiced = customer.invoices.reduce((sum, inv) => sum.plus(toDecimal(inv.totalAmount)), toDecimal(0));
    const totalPaymentsReceived = customer.payments.reduce((sum, p) => sum.plus(toDecimal(p.totalAmount)), toDecimal(0));
    const outstandingBalance = totalInvoiced.minus(totalPaymentsReceived);

    res.json({
      customer: {
        id: customer.id,
        companyName: customer.companyName,
        contactPerson: customer.contactPerson,
        email: customer.email,
        phone: customer.phone,
        country: customer.country
      },
      summary: {
        totalInvoiced: totalInvoiced.toFixed(2),
        totalPaymentsReceived: totalPaymentsReceived.toFixed(2),
        outstandingBalance: outstandingBalance.toFixed(2)
      },
      invoices: customer.invoices,
      payments: customer.payments
    });
  } catch (err) {
    next(err);
  }
});

export default router;
