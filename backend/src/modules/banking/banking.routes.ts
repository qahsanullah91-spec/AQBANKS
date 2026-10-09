import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';
import { maskAccountNumber } from '../../utils/masking.js';

const router = Router();

const updateBankSchema = z.object({
  bankName: z.string().min(2),
  beneficiaryName: z.string().min(2),
  accountNumber: z.string().min(4),
  swiftCode: z.string().min(8),
  correspondentBank: z.string().optional().nullable(),
  correspondentSwift: z.string().optional().nullable(),
  reason: z.string().min(5, 'Mandatory reason for updating bank routing information')
});

const revealSchema = z.object({
  reason: z.string().min(5, 'A business justification is required to reveal sensitive banking numbers')
});

// GET /api/bank-accounts (Always returns masked numbers)
router.get('/', authenticate, requirePermission('bank_details:view_masked'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      include: {
        companyProfile: true,
        versions: {
          orderBy: { versionNumber: 'desc' }
        }
      }
    });

    const safeAccounts = accounts.map(a => ({
      id: a.id,
      bankName: a.bankName,
      beneficiaryName: a.beneficiaryName,
      accountNumberMasked: a.accountNumberMasked,
      swiftCode: a.swiftCode,
      correspondentBank: a.correspondentBank,
      correspondentSwift: a.correspondentSwift,
      currency: a.currency,
      isPrimary: a.isPrimary,
      versionCount: a.versions.length,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt
    }));

    res.json(safeAccounts);
  } catch (err) {
    next(err);
  }
});

// POST /api/bank-accounts/:id/reveal (Audited reveal of unmasked account number)
router.post('/:id/reveal', authenticate, requirePermission('bank_details:reveal_unmasked'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reason } = revealSchema.parse(req.body);

    const account = await prisma.bankAccount.findUnique({
      where: { id: req.params.id }
    });

    if (!account) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bank account not found' });
      return;
    }

    // Record high-severity security audit event
    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'BANK_ACCOUNT_REVEALED',
      entityType: 'BANK_ACCOUNT',
      entityId: account.id,
      newValues: {
        reason,
        revealedTo: req.user!.email,
        timestamp: new Date().toISOString()
      },
      ipAddress: req.ip
    });

    res.json({
      id: account.id,
      bankName: account.bankName,
      beneficiaryName: account.beneficiaryName,
      accountNumberUnmasked: account.accountNumberEncrypted, // Returns unmasked
      swiftCode: account.swiftCode,
      correspondentBank: account.correspondentBank,
      correspondentSwift: account.correspondentSwift,
      revealedAt: new Date(),
      auditWarning: 'This unmasking event was recorded in the system compliance log.'
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/bank-accounts/:id (Update bank details with versioning)
router.put('/:id', authenticate, requirePermission('settings:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateBankSchema.parse(req.body);

    const existing = await prisma.bankAccount.findUnique({
      where: { id: req.params.id },
      include: { versions: { orderBy: { versionNumber: 'desc' } } }
    });

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bank account not found' });
      return;
    }

    const nextVersion = existing.versions.length > 0 ? existing.versions[0].versionNumber + 1 : 1;
    const masked = maskAccountNumber(data.accountNumber);

    const updated = await prisma.$transaction(async (tx) => {
      // Create version snapshot
      await tx.bankDetailVersion.create({
        data: {
          bankAccountId: existing.id,
          versionNumber: nextVersion,
          snapshotData: JSON.stringify({
            bankName: existing.bankName,
            beneficiaryName: existing.beneficiaryName,
            accountNumberMasked: existing.accountNumberMasked,
            swiftCode: existing.swiftCode,
            correspondentBank: existing.correspondentBank,
            correspondentSwift: existing.correspondentSwift
          }),
          effectiveDate: new Date(),
          createdBy: req.user!.email
        }
      });

      return tx.bankAccount.update({
        where: { id: existing.id },
        data: {
          bankName: data.bankName,
          beneficiaryName: data.beneficiaryName,
          accountNumberEncrypted: data.accountNumber,
          accountNumberMasked: masked,
          swiftCode: data.swiftCode,
          correspondentBank: data.correspondentBank || null,
          correspondentSwift: data.correspondentSwift || null
        }
      });
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'BANK_ACCOUNT_UPDATED',
      entityType: 'BANK_ACCOUNT',
      entityId: updated.id,
      newValues: {
        version: nextVersion,
        reason: data.reason,
        bankName: updated.bankName,
        accountNumberMasked: updated.accountNumberMasked
      },
      ipAddress: req.ip
    });

    res.json({
      id: updated.id,
      bankName: updated.bankName,
      beneficiaryName: updated.beneficiaryName,
      accountNumberMasked: updated.accountNumberMasked,
      swiftCode: updated.swiftCode,
      correspondentBank: updated.correspondentBank,
      correspondentSwift: updated.correspondentSwift,
      version: nextVersion
    });
  } catch (err) {
    next(err);
  }
});

export default router;
