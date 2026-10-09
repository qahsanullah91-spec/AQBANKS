import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { toDecimal } from '../../utils/decimal.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

const router = Router();

const allocationSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().or(z.string()).refine(v => Number(v) > 0, 'Allocation amount must be positive')
});

const createPaymentSchema = z.object({
  customerId: z.string().uuid(),
  financialAccountId: z.string().uuid().optional(),
  paymentDate: z.string(),
  reference: z.string().optional().nullable(),
  paymentMethod: z.string().default('WIRE_TRANSFER'),
  totalAmount: z.number().or(z.string()).refine(v => Number(v) > 0, 'Payment total must be positive'),
  currency: z.string().default('USD'),
  notes: z.string().optional().nullable(),
  allocations: z.array(allocationSchema).optional().default([])
});

// Helper to update invoice payment status based on total allocations
async function updateInvoicePaymentStatus(invoiceId: string, tx: any) {
  const inv = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { paymentAllocations: true }
  });
  if (!inv) return;

  const totalAllocated = inv.paymentAllocations.reduce(
    (sum: any, a: any) => sum.plus(toDecimal(a.amount)),
    toDecimal(0)
  );

  const invoiceTotal = toDecimal(inv.totalAmount);
  let newStatus = 'UNPAID';

  if (totalAllocated.greaterThanOrEqualTo(invoiceTotal)) {
    newStatus = 'PAID';
  } else if (totalAllocated.greaterThan(0)) {
    newStatus = 'PARTIALLY_PAID';
  }

  await tx.invoice.update({
    where: { id: invoiceId },
    data: { paymentStatus: newStatus }
  });
}

// GET /api/payments
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId, reference } = req.query;
    const where: any = {};
    if (customerId) where.customerId = String(customerId);
    if (reference) where.reference = { contains: String(reference) };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: true,
        financialAccount: true,
        allocations: {
          include: { invoice: true }
        }
      },
      orderBy: { paymentDate: 'desc' }
    });

    res.json(payments);
  } catch (err) {
    next(err);
  }
});

// POST /api/payments
router.post('/', authenticate, requirePermission('payment:create'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createPaymentSchema.parse(req.body);

    const totalAmount = toDecimal(data.totalAmount);

    // Sum proposed allocations
    let allocatedSum = toDecimal(0);
    for (const alloc of data.allocations) {
      allocatedSum = allocatedSum.plus(toDecimal(alloc.amount));
    }

    if (allocatedSum.greaterThan(totalAmount)) {
      res.status(400).json({
        error: 'OVER_ALLOCATION',
        message: `Sum of allocations ($${allocatedSum.toFixed(2)}) exceeds payment total ($${totalAmount.toFixed(2)})`
      });
      return;
    }

    const unallocatedAmount = totalAmount.minus(allocatedSum);

    // Default primary financial account
    let accountId = data.financialAccountId;
    if (!accountId) {
      const primaryAcc = await prisma.financialAccount.findFirst({ where: { currency: data.currency } });
      if (primaryAcc) accountId = primaryAcc.id;
      else {
        res.status(400).json({ error: 'ACCOUNT_NOT_FOUND', message: 'No financial account for currency ' + data.currency });
        return;
      }
    }

    // Check for potential duplicate payment
    let duplicateWarning = false;
    if (data.reference) {
      const dup = await prisma.payment.findFirst({
        where: {
          reference: data.reference,
          customerId: data.customerId,
          totalAmount: totalAmount.toNumber()
        }
      });
      if (dup) duplicateWarning = true;
    }

    const createdPayment = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          customerId: data.customerId,
          financialAccountId: accountId!,
          paymentDate: new Date(data.paymentDate),
          reference: data.reference || null,
          paymentMethod: data.paymentMethod,
          totalAmount: totalAmount.toNumber(),
          allocatedAmount: allocatedSum.toNumber(),
          unallocatedAmount: unallocatedAmount.toNumber(),
          currency: data.currency,
          notes: data.notes || null
        }
      });

      // Create allocations
      for (const alloc of data.allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: alloc.invoiceId,
            amount: toDecimal(alloc.amount).toNumber()
          }
        });
        await updateInvoicePaymentStatus(alloc.invoiceId, tx);
      }

      return payment;
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'PAYMENT_RECORDED',
      entityType: 'PAYMENT',
      entityId: createdPayment.id,
      newValues: {
        totalAmount: totalAmount.toFixed(2),
        allocatedAmount: allocatedSum.toFixed(2),
        unallocatedAmount: unallocatedAmount.toFixed(2),
        duplicateWarning
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      ...createdPayment,
      duplicateWarning: duplicateWarning ? 'A payment with identical reference, customer, and amount exists.' : null
    });
  } catch (err) {
    next(err);
  }
});

export default router;
