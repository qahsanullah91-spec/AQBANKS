import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

const router = Router();

const customerSchema = z.object({
  companyName: z.string().min(2),
  contactPerson: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  isCustomer: z.boolean().default(true),
  isVendor: z.boolean().default(false)
});

// GET /api/customers
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const search = req.query.search as string;
    const where: any = {};
    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { contactPerson: { contains: search } }
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: { invoices: true, payments: true }
        }
      },
      orderBy: { companyName: 'asc' }
    });

    res.json(customers);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        invoices: {
          orderBy: { issueDate: 'desc' }
        },
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!customer) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found' });
      return;
    }

    res.json(customer);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers
router.post('/', authenticate, requirePermission('settings:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = customerSchema.parse(req.body);

    const customer = await prisma.customer.create({
      data: {
        companyName: data.companyName,
        contactPerson: data.contactPerson,
        email: data.email,
        phone: data.phone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        country: data.country,
        isCustomer: data.isCustomer,
        isVendor: data.isVendor
      }
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'CUSTOMER_CREATED',
      entityType: 'CUSTOMER',
      entityId: customer.id,
      newValues: customer,
      ipAddress: req.ip
    });

    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticate, requirePermission('settings:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = customerSchema.partial().parse(req.body);

    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found' });
      return;
    }

    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'CUSTOMER_UPDATED',
      entityType: 'CUSTOMER',
      entityId: updated.id,
      oldValues: existing,
      newValues: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
