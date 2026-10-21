import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { calculateLedgerRunningBalances, toDecimal } from '../../utils/decimal.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';
import { receiptsService } from '../receipts/receipts.service.js';
import { classifyExpense } from '../reports/reports.routes.js';

const router = Router();

const createLedgerEntrySchema = z.object({
  financialAccountId: z.string().uuid().optional(),
  effectiveDate: z.string(), // ISO date string
  reference: z.string().optional().nullable(),
  description: z.string().min(2),
  category: z.enum(['BALANCE', 'CREDIT', 'DEBIT']),
  debitAmount: z.number().or(z.string()).default(0),
  creditAmount: z.number().or(z.string()).default(0),
  currency: z.string().default('USD'),
  notes: z.string().optional().nullable()
});

const reverseEntrySchema = z.object({
  reason: z.string().min(5, 'Mandatory reversal justification required')
});

// GET /api/ledger
router.get('/', authenticate, requirePermission('ledger:view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category, search, startDate, endDate } = req.query;

    const cleanParam = (val: any) => {
      if (!val) return undefined;
      const str = String(val).trim();
      if (str === '' || str === 'undefined' || str === 'null' || str === 'ALL') return undefined;
      return str;
    };

    const where: any = {};
    const sCategory = cleanParam(category);
    if (sCategory) where.category = sCategory;

    const sSearch = cleanParam(search);
    if (sSearch) {
      where.OR = [
        { description: { contains: sSearch } },
        { reference: { contains: sSearch } }
      ];
    }
    const sStartDate = cleanParam(startDate);
    const sEndDate = cleanParam(endDate);
    if (sStartDate || sEndDate) {
      where.effectiveDate = {};
      if (sStartDate) where.effectiveDate.gte = new Date(sStartDate);
      if (sEndDate) where.effectiveDate.lte = new Date(sEndDate);
    }

    // Fetch primary financial account
    const financialAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
    const openingBalance = financialAccount ? financialAccount.openingBalance : 0;

    // Fetch all transactions to compute deterministic running balance
    const allTxs = await prisma.ledgerTransaction.findMany({
      orderBy: [
        { effectiveDate: 'asc' },
        { postedAt: 'asc' },
        { id: 'asc' }
      ]
    });

    // Compute running balances across full timeline
    const calculated = calculateLedgerRunningBalances(openingBalance, allTxs.map(t => ({
      id: t.id,
      effectiveDate: t.effectiveDate,
      postedAt: t.postedAt,
      category: t.category,
      debitAmount: t.debitAmount,
      creditAmount: t.creditAmount
    })));

    // Map calculated running balances by ID
    const balanceMap = new Map(calculated.map(c => [c.id, c.runningBalanceFormatted]));

    // Apply query filters to final presentation
    const filteredTxs = allTxs.filter(tx => {
      if (category && tx.category !== category) return false;
      if (search) {
        const s = String(search).toLowerCase();
        const descMatch = tx.description.toLowerCase().includes(s);
        const refMatch = tx.reference ? tx.reference.toLowerCase().includes(s) : false;
        if (!descMatch && !refMatch) return false;
      }
      if (startDate && tx.effectiveDate < new Date(String(startDate))) return false;
      if (endDate && tx.effectiveDate > new Date(String(endDate))) return false;
      return true;
    });

    const results = filteredTxs.map(tx => ({
      ...tx,
      expenseCategory: classifyExpense(tx),
      runningBalance: balanceMap.get(tx.id) || '0.00'
    }));

    // Current ending balance
    const currentEndingBalance = calculated.length > 0 ? calculated[calculated.length - 1].runningBalanceFormatted : toDecimal(openingBalance).toFixed(2);

    res.json({
      openingBalance: toDecimal(openingBalance).toFixed(2),
      currentEndingBalance,
      totalCount: results.length,
      transactions: results
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ledger
router.post('/', authenticate, requirePermission('ledger:post_entry'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createLedgerEntrySchema.parse(req.body);

    const debit = toDecimal(data.debitAmount);
    const credit = toDecimal(data.creditAmount);

    if (debit.isZero() && credit.isZero()) {
      res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Either debit or credit must be greater than zero' });
      return;
    }
    if (debit.isPositive() && credit.isPositive() && !debit.isZero() && !credit.isZero()) {
      res.status(400).json({ error: 'INVALID_AMOUNT', message: 'A transaction cannot have both positive debit and credit' });
      return;
    }

    let accountId = data.financialAccountId;
    if (!accountId) {
      const primaryAccount = await prisma.financialAccount.findFirst({ where: { currency: data.currency } });
      if (!primaryAccount) {
        res.status(400).json({ error: 'ACCOUNT_NOT_FOUND', message: 'No financial account found for currency ' + data.currency });
        return;
      }
      accountId = primaryAccount.id;
    }

    const tx = await prisma.ledgerTransaction.create({
      data: {
        financialAccountId: accountId,
        effectiveDate: new Date(data.effectiveDate),
        reference: data.reference || null,
        description: data.description,
        category: data.category,
        debitAmount: debit.toNumber(),
        creditAmount: credit.toNumber(),
        currency: data.currency,
        notes: data.notes || null
      }
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'LEDGER_ENTRY_POSTED',
      entityType: 'LEDGER_TRANSACTION',
      entityId: tx.id,
      newValues: {
        description: tx.description,
        debit: debit.toFixed(2),
        credit: credit.toFixed(2)
      },
      ipAddress: req.ip
    });

    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

// POST /api/ledger/:id/reverse (Post reversing adjustment)
router.post('/:id/reverse', authenticate, requirePermission('ledger:reverse_entry'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reason } = reverseEntrySchema.parse(req.body);

    const original = await prisma.ledgerTransaction.findUnique({
      where: { id: req.params.id },
      include: { reversal: true }
    });

    if (!original) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Transaction not found' });
      return;
    }

    if (original.isReversal) {
      res.status(400).json({ error: 'CANNOT_REVERSE_REVERSAL', message: 'Cannot reverse an existing reversal transaction' });
      return;
    }

    if (original.reversal) {
      res.status(400).json({ error: 'ALREADY_REVERSED', message: 'This transaction has already been reversed' });
      return;
    }

    // Create opposite entry: if original had credit, reversal has debit, and vice versa
    const reversalTx = await prisma.ledgerTransaction.create({
      data: {
        financialAccountId: original.financialAccountId,
        effectiveDate: new Date(),
        reference: original.reference ? `REV-${original.reference}` : 'REVERSAL',
        description: `REVERSAL of [${original.description}]: ${reason}`,
        category: original.category === 'CREDIT' ? 'DEBIT' : 'CREDIT',
        debitAmount: original.creditAmount, // Invert
        creditAmount: original.debitAmount, // Invert
        currency: original.currency,
        reversalOfId: original.id,
        isReversal: true,
        notes: reason
      }
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'LEDGER_ENTRY_REVERSED',
      entityType: 'LEDGER_TRANSACTION',
      entityId: original.id,
      newValues: { reversalId: reversalTx.id, reason },
      ipAddress: req.ip
    });

    res.status(201).json(reversalTx);
  } catch (err) {
    next(err);
  }
});

// PUT /api/ledger/:id (Edit ledger entry & recalculate deterministic running balances)
const updateLedgerEntrySchema = z.object({
  effectiveDate: z.string().optional(),
  reference: z.string().optional().nullable(),
  description: z.string().min(2).optional(),
  category: z.enum(['BALANCE', 'CREDIT', 'DEBIT']).optional(),
  debitAmount: z.number().or(z.string()).optional(),
  creditAmount: z.number().or(z.string()).optional(),
  notes: z.string().optional().nullable()
});

router.put('/:id', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateLedgerEntrySchema.parse(req.body);
    const existing = await prisma.ledgerTransaction.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Transaction not found' });
      return;
    }

    const updateData: any = {};
    if (data.effectiveDate) updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.reference !== undefined) updateData.reference = data.reference;
    if (data.description) updateData.description = data.description;
    if (data.category) updateData.category = data.category;
    if (data.debitAmount !== undefined) updateData.debitAmount = toDecimal(data.debitAmount).toNumber();
    if (data.creditAmount !== undefined) updateData.creditAmount = toDecimal(data.creditAmount).toNumber();
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.ledgerTransaction.update({
      where: { id: existing.id },
      data: updateData
    });

    // Recalculate deterministic running balances across all transactions
    const financialAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
    const openingBalance = financialAccount ? financialAccount.openingBalance : 0;
    const allTxs = await prisma.ledgerTransaction.findMany({
      orderBy: [{ effectiveDate: 'asc' }, { postedAt: 'asc' }, { id: 'asc' }]
    });
    const calculated = calculateLedgerRunningBalances(openingBalance, allTxs);

    await prisma.$transaction(
      calculated.map(c => prisma.ledgerTransaction.update({
        where: { id: c.id },
        data: { runningBalance: c.runningBalance.toNumber() }
      }))
    );

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'LEDGER_ENTRY_UPDATED',
      entityType: 'LEDGER_TRANSACTION',
      entityId: updated.id,
      newValues: updateData,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ledger/:id (Delete transaction & recalculate deterministic running balances)
router.delete('/:id', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.ledgerTransaction.findUnique({
      where: { id: req.params.id },
      include: { receipt: true }
    });

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Transaction not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      if (existing.receipt) {
        await tx.receipt.update({
          where: { id: existing.receipt.id },
          data: { ledgerTransactionId: null }
        });
      }
      await tx.ledgerTransaction.delete({ where: { id: existing.id } });
    });

    // Recalculate deterministic running balances
    const financialAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
    const openingBalance = financialAccount ? financialAccount.openingBalance : 0;
    const allTxs = await prisma.ledgerTransaction.findMany({
      orderBy: [{ effectiveDate: 'asc' }, { postedAt: 'asc' }, { id: 'asc' }]
    });
    const calculated = calculateLedgerRunningBalances(openingBalance, allTxs);

    if (calculated.length > 0) {
      await prisma.$transaction(
        calculated.map(c => prisma.ledgerTransaction.update({
          where: { id: c.id },
          data: { runningBalance: c.runningBalance.toNumber() }
        }))
      );
    }

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'LEDGER_ENTRY_DELETED',
      entityType: 'LEDGER_TRANSACTION',
      entityId: existing.id,
      newValues: { description: existing.description },
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Transaction deleted and running balances updated' });
  } catch (err) {
    next(err);
  }
});

// POST /api/ledger/cash-in (Receive Money / Credit with optional invoice linking and receipt creation)
const cashInSchema = z.object({
  effectiveDate: z.string(),
  reference: z.string().optional().nullable(),
  description: z.string().min(2),
  payerName: z.string().optional().nullable(),
  amount: z.number().positive('Amount must be positive'),
  swiftFee: z.number().min(0).default(0),
  invoiceId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createReceipt: z.boolean().default(true)
});

router.post('/cash-in', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = cashInSchema.parse(req.body);
    const amountDec = toDecimal(data.amount);
    const swiftDec = toDecimal(data.swiftFee);

    if (swiftDec.gte(amountDec)) {
      res.status(400).json({ error: 'INVALID_FEE', message: 'SWIFT fee cannot be greater than or equal to the total amount' });
      return;
    }

    const netCredited = swiftDec.gt(0) ? amountDec.minus(swiftDec) : amountDec;

    const finAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
    const accountId = finAccount ? finAccount.id : (await prisma.financialAccount.findFirst())?.id;
    if (!accountId) {
      res.status(400).json({ error: 'ACCOUNT_NOT_FOUND', message: 'No financial account found for USD' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Ledger Credit (Net wire proceeds credited to bank account)
      const ledgerTx = await tx.ledgerTransaction.create({
        data: {
          financialAccountId: accountId,
          effectiveDate: new Date(data.effectiveDate),
          reference: data.reference || null,
          description: data.description,
          category: 'CREDIT',
          creditAmount: netCredited.toNumber(),
          debitAmount: 0,
          currency: 'USD',
          notes: data.notes || (swiftDec.gt(0) ? `Gross payment: $${amountDec.toFixed(2)} less SWIFT fee: $${swiftDec.toFixed(2)}` : null)
        }
      });

      let updatedInvoice = null;
      let createdPayment = null;
      let createdReceipt = null;

      // If linked to an invoice
      if (data.invoiceId) {
        const inv = await tx.invoice.findUnique({
          where: { id: data.invoiceId },
          include: { paymentAllocations: true, customer: true }
        });
        if (inv) {
          const currentAllocated = inv.paymentAllocations.reduce((sum, a) => sum.plus(toDecimal(a.amount)).plus(toDecimal(a.swiftBankFee || 0)), toDecimal(0));
          const newTotalAllocated = currentAllocated.plus(amountDec);
          const newStatus = newTotalAllocated.gte(toDecimal(inv.totalAmount)) ? 'PAID' : 'PARTIALLY_PAID';

          updatedInvoice = await tx.invoice.update({
            where: { id: inv.id },
            data: { paymentStatus: newStatus }
          });

          createdPayment = await tx.payment.create({
            data: {
              customerId: inv.customerId,
              financialAccountId: accountId,
              paymentDate: new Date(data.effectiveDate),
              reference: data.reference || `PMT-${inv.invoiceNumber}`,
              paymentMethod: 'WIRE_TRANSFER',
              totalAmount: amountDec.toNumber(),
              allocatedAmount: amountDec.toNumber(),
              unallocatedAmount: 0,
              currency: 'USD',
              allocations: {
                create: {
                  invoiceId: inv.id,
                  amount: netCredited.toNumber(),
                  swiftBankFee: swiftDec.toNumber(),
                  notes: data.notes || null
                }
              }
            }
          });
        }
      }

      // If receipt creation requested
      if (data.createReceipt) {
        let payer = data.payerName;
        if (!payer && data.invoiceId) {
          const invObj = await tx.invoice.findUnique({ where: { id: data.invoiceId }, include: { customer: true } });
          payer = invObj?.customer?.companyName;
        }
        if (!payer) payer = 'Customer Direct Payment';

        createdReceipt = await receiptsService.createReceipt({
          paymentId: createdPayment?.id,
          ledgerTransactionId: ledgerTx.id,
          payerName: payer,
          receivingAccountName: 'Afghan United Bank Operating Account',
          receivingAccountMasked: '101502******0472',
          amount: netCredited.toNumber(),
          grossAmount: amountDec.toNumber(),
          swiftFeeAmount: swiftDec.toNumber(),
          currency: 'USD',
          paymentMethod: 'WIRE_TRANSFER',
          referenceNumber: data.reference || undefined,
          purpose: data.description,
          invoiceId: data.invoiceId || undefined,
          notes: data.notes || undefined,
          createdById: req.user?.userId
        }, tx);
      }

      return { ledgerTx, updatedInvoice, createdPayment, createdReceipt };
    });

    // Recalculate deterministic running balances
    const financialAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
    const openingBalance = financialAccount ? financialAccount.openingBalance : 0;
    const allTxs = await prisma.ledgerTransaction.findMany({
      orderBy: [{ effectiveDate: 'asc' }, { postedAt: 'asc' }, { id: 'asc' }]
    });
    const calculated = calculateLedgerRunningBalances(openingBalance, allTxs);
    await prisma.$transaction(
      calculated.map(c => prisma.ledgerTransaction.update({
        where: { id: c.id },
        data: { runningBalance: c.runningBalance.toNumber() }
      }))
    );

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'CASH_IN_RECORDED',
      entityType: 'LEDGER_TRANSACTION',
      entityId: result.ledgerTx.id,
      newValues: { amount: data.amount, reference: data.reference },
      ipAddress: req.ip
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ledger/cash-out (Pay Expense / Outflow debit entry)
const cashOutSchema = z.object({
  effectiveDate: z.string(),
  reference: z.string().optional().nullable(),
  description: z.string().min(2),
  payeeName: z.string().optional().nullable(),
  category: z.string().default('OPERATING_EXPENSE'),
  amount: z.number().positive('Amount must be positive'),
  notes: z.string().optional().nullable()
});

router.post('/cash-out', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = cashOutSchema.parse(req.body);
    const amountDec = toDecimal(data.amount);

    const finAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
    const accountId = finAccount ? finAccount.id : (await prisma.financialAccount.findFirst())?.id;
    if (!accountId) {
      res.status(400).json({ error: 'ACCOUNT_NOT_FOUND', message: 'No financial account found for USD' });
      return;
    }

    const desc = data.payeeName ? `Payment to ${data.payeeName} - ${data.description}` : data.description;
    const finalNotes = data.notes
      ? (data.notes.includes('[') ? data.notes : `[${data.category}] ${data.notes}`)
      : `[${data.category}]`;

    const ledgerTx = await prisma.ledgerTransaction.create({
      data: {
        financialAccountId: accountId,
        effectiveDate: new Date(data.effectiveDate),
        reference: data.reference || null,
        description: desc,
        category: 'DEBIT',
        debitAmount: amountDec.toNumber(),
        creditAmount: 0,
        currency: 'USD',
        notes: finalNotes
      }
    });

    // Recalculate running balances
    const openingBalance = finAccount ? finAccount.openingBalance : 0;
    const allTxs = await prisma.ledgerTransaction.findMany({
      orderBy: [{ effectiveDate: 'asc' }, { postedAt: 'asc' }, { id: 'asc' }]
    });
    const calculated = calculateLedgerRunningBalances(openingBalance, allTxs);
    await prisma.$transaction(
      calculated.map(c => prisma.ledgerTransaction.update({
        where: { id: c.id },
        data: { runningBalance: c.runningBalance.toNumber() }
      }))
    );

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'CASH_OUT_RECORDED',
      entityType: 'LEDGER_TRANSACTION',
      entityId: ledgerTx.id,
      newValues: { amount: data.amount, payee: data.payeeName },
      ipAddress: req.ip
    });

    res.status(201).json(ledgerTx);
  } catch (err) {
    next(err);
  }
});

export default router;
