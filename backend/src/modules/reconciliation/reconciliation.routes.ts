import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { toDecimal } from '../../utils/decimal.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

const router = Router();

// GET /api/reconciliation/suggestions
router.get('/suggestions', authenticate, requirePermission('ledger:view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Find unreconciled credits
    const unreconciledCredits = await prisma.ledgerTransaction.findMany({
      where: {
        category: 'CREDIT',
        reconciliationStatus: { in: ['UNRECONCILED', 'DISCREPANCY'] }
      },
      orderBy: { effectiveDate: 'asc' }
    });

    // Find pending/unpaid or partially paid invoices
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        status: { in: ['DRAFT', 'ISSUED'] }
      },
      include: {
        customer: true,
        paymentAllocations: true
      }
    });

    const suggestions: any[] = [];

    for (const tx of unreconciledCredits) {
      const creditAmount = toDecimal(tx.creditAmount);
      const descLower = tx.description.toLowerCase();

      // Look for candidate invoices
      const candidates = pendingInvoices.map(inv => {
        let score = 0;
        const reasons: string[] = [];

        // Check buyer name match
        const buyerName = inv.customer.companyName.toLowerCase();
        const shortBuyer = buyerName.split(' ')[0];
        if (descLower.includes(shortBuyer)) {
          score += 40;
          reasons.push(`Buyer match: "${inv.customer.companyName}"`);
        }

        // Check invoice ref match
        if (inv.sourceInvoiceRef && descLower.includes(inv.sourceInvoiceRef.toLowerCase())) {
          score += 35;
          reasons.push(`Invoice ref match: "${inv.sourceInvoiceRef}"`);
        }

        // Check amount proximity
        const invTotal = toDecimal(inv.totalAmount);
        const diff = invTotal.minus(creditAmount).abs();
        const diffNum = diff.toNumber();

        if (diffNum === 0) {
          score += 25;
          reasons.push('Exact amount match');
        } else if (diffNum <= 1000) {
          // Wire fee tolerance range
          score += 15;
          reasons.push(`Variance $${diff.toFixed(2)} within intermediary wire deduction threshold`);
        }

        return {
          invoice: {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            sourceInvoiceRef: inv.sourceInvoiceRef,
            issueDate: inv.issueDate,
            totalAmount: invTotal.toFixed(2),
            customerName: inv.customer.companyName
          },
          score: Math.min(score, 100),
          variance: invTotal.minus(creditAmount).toFixed(2),
          reasons
        };
      }).filter(c => c.score >= 30)
        .sort((a, b) => b.score - a.score);

      suggestions.push({
        ledgerTransaction: {
          id: tx.id,
          effectiveDate: tx.effectiveDate,
          reference: tx.reference,
          description: tx.description,
          creditAmount: creditAmount.toFixed(2),
          reconciliationStatus: tx.reconciliationStatus
        },
        bestMatch: candidates.length > 0 ? candidates[0] : null,
        candidateMatches: candidates
      });
    }

    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

const confirmReconciliationSchema = z.object({
  ledgerTransactionId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  allocationAmount: z.number().or(z.string()),
  notes: z.string().optional()
});

// POST /api/reconciliation/confirm
router.post('/confirm', authenticate, requirePermission('ledger:post_entry'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = confirmReconciliationSchema.parse(req.body);

    const tx = await prisma.ledgerTransaction.findUnique({
      where: { id: data.ledgerTransactionId },
      include: { financialAccount: true }
    });

    if (!tx) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Ledger transaction not found' });
      return;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { customer: true, paymentAllocations: true }
    });

    if (!invoice) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }

    const amount = toDecimal(data.allocationAmount);

    const result = await prisma.$transaction(async (prismaTx) => {
      // 1. Create payment record
      const payment = await prismaTx.payment.create({
        data: {
          customerId: invoice.customerId,
          financialAccountId: tx.financialAccountId,
          paymentDate: tx.effectiveDate,
          reference: tx.reference || 'REC-' + tx.id.slice(0, 8),
          paymentMethod: 'WIRE_TRANSFER',
          totalAmount: amount.toNumber(),
          allocatedAmount: amount.toNumber(),
          unallocatedAmount: 0,
          currency: tx.currency,
          notes: data.notes || `Reconciled with ledger tx: ${tx.description}`
        }
      });

      // 2. Create allocation
      await prismaTx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: amount.toNumber(),
          notes: 'Auto-allocated from reconciliation match'
        }
      });

      // 3. Mark ledger transaction reconciled
      const updatedTx = await prismaTx.ledgerTransaction.update({
        where: { id: tx.id },
        data: { reconciliationStatus: 'RECONCILED' }
      });

      // 4. Update invoice payment status
      const existingAllocated = invoice.paymentAllocations.reduce(
        (sum, a) => sum.plus(toDecimal(a.amount)),
        toDecimal(0)
      );
      const totalPaid = existingAllocated.plus(amount);
      const invoiceTotal = toDecimal(invoice.totalAmount);

      const newStatus = totalPaid.greaterThanOrEqualTo(invoiceTotal) ? 'PAID' : 'PARTIALLY_PAID';

      await prismaTx.invoice.update({
        where: { id: invoice.id },
        data: { paymentStatus: newStatus }
      });

      return { payment, updatedTx };
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'RECONCILIATION_CONFIRMED',
      entityType: 'RECONCILIATION',
      entityId: tx.id,
      newValues: {
        invoiceNumber: invoice.invoiceNumber,
        allocatedAmount: amount.toFixed(2),
        ledgerDescription: tx.description
      },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Reconciliation confirmed and payment allocated successfully.',
      result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
