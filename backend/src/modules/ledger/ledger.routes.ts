import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { calculateLedgerRunningBalances, toDecimal } from '../../utils/decimal.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

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

export default router;
