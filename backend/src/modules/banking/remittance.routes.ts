import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

const router = Router();

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

// GET /api/remittance-profiles
router.get('/', authenticate, requirePermission('bank_details:view_masked'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
router.get('/:id', authenticate, requirePermission('bank_details:view_masked'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
router.post('/', authenticate, requirePermission('remittance:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = remittanceProfileSchema.parse(req.body);

    const created = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
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
router.put('/:id', authenticate, requirePermission('remittance:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = remittanceProfileSchema.partial().parse(req.body);

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
router.patch('/:id/toggle-active', authenticate, requirePermission('remittance:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
router.patch('/:id/set-default', authenticate, requirePermission('remittance:set_default'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
          isActive: true, // Default profile must be active
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
router.get('/:id/document', authenticate, requirePermission('bank_details:export'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

    // Audit document export
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
