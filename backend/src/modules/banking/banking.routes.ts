import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';
import { maskAccountNumber } from '../../utils/masking.js';

const router = Router();

// Helper to mask CIF numbers (preserve last 4 characters, e.g. "******4739")
function maskCifNumber(cif: string): string {
  if (!cif) return '******';
  const clean = cif.trim();
  if (clean.length <= 4) return '******';
  return '*'.repeat(clean.length - 4) + clean.slice(-4);
}

const updateBankSchema = z.object({
  bankName: z.string().min(2),
  beneficiaryName: z.string().min(2),
  accountNumber: z.string().min(4),
  cifNumber: z.string().optional().nullable(),
  accountType: z.string().default('AWDCCA'),
  accountStatus: z.string().default('Active'),
  branchName: z.string().optional().nullable(),
  swiftCode: z.string().min(8),
  correspondentBank: z.string().optional().nullable(),
  correspondentSwift: z.string().optional().nullable(),
  reason: z.string().min(5, 'Mandatory business justification for updating bank routing information')
});

const revealSchema = z.object({
  reason: z.string().min(5, 'A business justification is required to reveal sensitive banking numbers')
});

const remittanceProfileSchema = z.object({
  bankAccountId: z.string().uuid(),
  profileType: z.enum(['LOCAL', 'INTERNATIONAL']),
  name: z.string().min(3),
  beneficiaryName: z.string().min(2),
  beneficiaryAccount: z.string().min(4),
  beneficiaryBank: z.string().min(2),
  beneficiaryBankAddress: z.string().min(2),
  beneficiarySwift: z.string().min(8),
  swiftField57A: z.string().optional().nullable(),
  swiftField59A: z.string().optional().nullable(),
  aubAccountWithCorrespondent: z.string().optional().nullable(),
  correspondentBank: z.string().min(2),
  correspondentSwift: z.string().min(8),
  correspondentAccount: z.string().optional().nullable(),
  correspondentLocation: z.string().optional().nullable(),
  swiftField56A: z.string().optional().nullable(),
  intermediaryBank: z.string().optional().nullable(),
  intermediarySwift: z.string().optional().nullable(),
  swiftField54A: z.string().optional().nullable(),
  mt103VerificationFlag: z.boolean().default(false),
  verificationNotes: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

// ==========================================
// 1. BANK ACCOUNTS ENDPOINTS
// ==========================================

// GET /api/bank-accounts (Always returns masked numbers)
router.get('/', authenticate, requirePermission('bank_details:view_masked'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      include: {
        companyProfile: true,
        remittanceProfiles: {
          orderBy: { createdAt: 'asc' }
        },
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
      cifNumberMasked: a.cifNumberMasked || maskCifNumber(a.cifNumberEncrypted || '000374739'),
      accountType: a.accountType,
      accountStatus: a.accountStatus,
      openingDate: a.openingDate ? a.openingDate.toISOString() : '2026-09-13T00:00:00.000Z',
      branchName: a.branchName,
      swiftCode: a.swiftCode,
      correspondentBank: a.correspondentBank,
      correspondentSwift: a.correspondentSwift,
      currency: a.currency,
      isPrimary: a.isPrimary,
      remittanceProfiles: a.remittanceProfiles,
      versionCount: a.versions.length,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt
    }));

    res.json(safeAccounts);
  } catch (err) {
    next(err);
  }
});

// POST /api/bank-accounts/:id/reveal (Audited reveal of unmasked account number and CIF)
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
        revealedFields: ['accountNumber', 'cifNumber'],
        timestamp: new Date().toISOString()
      },
      ipAddress: req.ip
    });

    res.json({
      id: account.id,
      bankName: account.bankName,
      beneficiaryName: account.beneficiaryName,
      accountNumberUnmasked: account.accountNumberEncrypted, // Returns unmasked
      cifNumberUnmasked: account.cifNumberEncrypted || '000374739', // Returns unmasked
      swiftCode: account.swiftCode,
      accountType: account.accountType,
      accountStatus: account.accountStatus,
      openingDate: account.openingDate,
      branchName: account.branchName,
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
router.put('/:id', authenticate, requirePermission('bank_details:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
    const maskedAccount = maskAccountNumber(data.accountNumber);
    const maskedCif = data.cifNumber ? maskCifNumber(data.cifNumber) : existing.cifNumberMasked;

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
            cifNumberMasked: existing.cifNumberMasked,
            accountType: existing.accountType,
            accountStatus: existing.accountStatus,
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
          accountNumberMasked: maskedAccount,
          cifNumberEncrypted: data.cifNumber || existing.cifNumberEncrypted,
          cifNumberMasked: maskedCif,
          accountType: data.accountType,
          accountStatus: data.accountStatus,
          branchName: data.branchName || existing.branchName,
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
      cifNumberMasked: updated.cifNumberMasked,
      accountType: updated.accountType,
      accountStatus: updated.accountStatus,
      swiftCode: updated.swiftCode,
      correspondentBank: updated.correspondentBank,
      correspondentSwift: updated.correspondentSwift,
      version: nextVersion
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/bank-accounts/:id/history (Audit trail & version snapshots)
router.get('/:id/history', authenticate, requirePermission('bank_details:view_history'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [versions, auditLogs] = await Promise.all([
      prisma.bankDetailVersion.findMany({
        where: { bankAccountId: req.params.id },
        orderBy: { versionNumber: 'desc' }
      }),
      prisma.auditEvent.findMany({
        where: {
          entityType: 'BANK_ACCOUNT',
          entityId: req.params.id
        },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    ]);

    res.json({ versions, auditLogs });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. REMITTANCE PROFILES ENDPOINTS
// ==========================================

// GET /api/remittance-profiles
router.get('/remittance-profiles', authenticate, requirePermission('bank_details:view_masked'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { profileType, isActive, search } = req.query;
    const where: any = {};

    if (profileType && profileType !== 'ALL') {
      where.profileType = String(profileType);
    }
    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q } },
        { correspondentBank: { contains: q } },
        { intermediaryBank: { contains: q } }
      ];
    }

    const profiles = await prisma.remittanceProfile.findMany({
      where,
      include: { bankAccount: true },
      orderBy: [{ isDefault: 'desc' }, { profileType: 'asc' }]
    });

    res.json(profiles);
  } catch (err) {
    next(err);
  }
});

// GET /api/remittance-profiles/:id
router.get('/remittance-profiles/:id', authenticate, requirePermission('bank_details:view_masked'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await prisma.remittanceProfile.findUnique({
      where: { id: req.params.id },
      include: { bankAccount: true }
    });

    if (!profile) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Remittance profile not found' });
      return;
    }

    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// POST /api/remittance-profiles
router.post('/remittance-profiles', authenticate, requirePermission('remittance:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = remittanceProfileSchema.parse(req.body);

    const created = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        // Un-default other profiles
        await tx.remittanceProfile.updateMany({
          where: { isDefault: true },
          data: { isDefault: false }
        });
      }

      return tx.remittanceProfile.create({
        data: {
          ...data,
          createdBy: req.user!.email,
          updatedBy: req.user!.email
        }
      });
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'REMITTANCE_PROFILE_CREATED',
      entityType: 'REMITTANCE_PROFILE',
      entityId: created.id,
      newValues: { name: created.name, profileType: created.profileType },
      ipAddress: req.ip
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/remittance-profiles/:id
router.put('/remittance-profiles/:id', authenticate, requirePermission('remittance:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = remittanceProfileSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.remittanceProfile.updateMany({
          where: { isDefault: true, id: { not: req.params.id } },
          data: { isDefault: false }
        });
      }

      return tx.remittanceProfile.update({
        where: { id: req.params.id },
        data: {
          ...data,
          updatedBy: req.user!.email
        }
      });
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'REMITTANCE_PROFILE_UPDATED',
      entityType: 'REMITTANCE_PROFILE',
      entityId: updated.id,
      newValues: { name: updated.name, profileType: updated.profileType },
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/remittance-profiles/:id/toggle-active
router.patch('/remittance-profiles/:id/toggle-active', authenticate, requirePermission('remittance:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await prisma.remittanceProfile.findUnique({
      where: { id: req.params.id }
    });

    if (!profile) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Remittance profile not found' });
      return;
    }

    const updated = await prisma.remittanceProfile.update({
      where: { id: req.params.id },
      data: {
        isActive: !profile.isActive,
        updatedBy: req.user!.email
      }
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'REMITTANCE_PROFILE_STATUS_CHANGED',
      entityType: 'REMITTANCE_PROFILE',
      entityId: updated.id,
      newValues: { isActive: updated.isActive },
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/remittance-profiles/:id/set-default
router.patch('/remittance-profiles/:id/set-default', authenticate, requirePermission('remittance:set_default'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.remittanceProfile.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });

      return tx.remittanceProfile.update({
        where: { id: req.params.id },
        data: {
          isDefault: true,
          isActive: true, // A default profile must be active
          updatedBy: req.user!.email
        }
      });
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'REMITTANCE_PROFILE_DEFAULT_CHANGED',
      entityType: 'REMITTANCE_PROFILE',
      entityId: updated.id,
      newValues: { isDefault: true },
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/remittance-profiles/:id/document (Printable / Exportable Bank Instructions)
router.get('/remittance-profiles/:id/document', authenticate, requirePermission('bank_details:export'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await prisma.remittanceProfile.findUnique({
      where: { id: req.params.id },
      include: {
        bankAccount: {
          include: { companyProfile: true }
        }
      }
    });

    if (!profile) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Remittance profile not found' });
      return;
    }

    // Audit export
    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'BANKING_DOCUMENT_EXPORTED',
      entityType: 'REMITTANCE_PROFILE',
      entityId: profile.id,
      newValues: {
        exportedBy: req.user!.email,
        profileType: profile.profileType,
        timestamp: new Date().toISOString()
      },
      ipAddress: req.ip
    });

    const doc = {
      organization: {
        legalName: 'SKY ARIANA LTD',
        portalName: 'AQ COMPANIES',
        email: 'info@skyariana.com',
        website: 'www.skyariana.com'
      },
      documentTitle: profile.profileType === 'LOCAL'
        ? 'OFFICIAL LOCAL USD INWARD REMITTANCE INSTRUCTIONS'
        : 'OFFICIAL INTERNATIONAL USD INWARD REMITTANCE INSTRUCTIONS',
      profile: {
        id: profile.id,
        name: profile.name,
        profileType: profile.profileType,
        currency: 'USD',
        beneficiary: {
          name: profile.beneficiaryName,
          accountNumber: profile.beneficiaryAccount,
          swiftField59A: profile.swiftField59A || profile.beneficiaryAccount
        },
        beneficiaryBank: {
          name: profile.beneficiaryBank,
          address: profile.beneficiaryBankAddress,
          swiftBic: profile.beneficiarySwift,
          swiftField57A: profile.swiftField57A || profile.beneficiarySwift,
          accountWithCorrespondent: profile.aubAccountWithCorrespondent
        },
        correspondentBank: {
          name: profile.correspondentBank,
          swiftBic: profile.correspondentSwift,
          accountNumber: profile.correspondentAccount,
          location: profile.correspondentLocation,
          swiftField56A: profile.swiftField56A || profile.correspondentSwift
        },
        intermediaryBank: profile.intermediaryBank ? {
          name: profile.intermediaryBank,
          swiftBic: profile.intermediarySwift,
          swiftField54A: profile.swiftField54A,
          mandatoryInstruction: 'Intermediary Bank is mandatory in Field 54A',
          mt103VerificationFlag: profile.mt103VerificationFlag,
          verificationNotes: profile.verificationNotes
        } : null,
        securityCompliance: {
          maskedAccount: profile.bankAccount.accountNumberMasked,
          maskedCif: profile.bankAccount.cifNumberMasked,
          generatedAt: new Date().toISOString(),
          authorizedOperator: req.user!.email
        }
      }
    };

    res.json(doc);
  } catch (err) {
    next(err);
  }
});

export default router;
