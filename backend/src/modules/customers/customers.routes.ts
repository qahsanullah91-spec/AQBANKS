import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

const router = Router();

const customerSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  contactPerson: z.string().optional().nullable().or(z.literal('')),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  addressLine1: z.string().optional().nullable().or(z.literal('')),
  addressLine2: z.string().optional().nullable().or(z.literal('')),
  country: z.string().optional().nullable().or(z.literal('')),
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
router.post('/', authenticate, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const allowed =
    req.user?.roles.some(r => ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR'].includes(r.toUpperCase())) ||
    req.user?.permissions.includes('settings:manage') ||
    req.user?.permissions.includes('invoice:create_draft');
  if (allowed) {
    return next();
  }
  res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied: missing permission to create customers' });
}, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = customerSchema.parse(req.body);

    const customer = await prisma.customer.create({
      data: {
        companyName: data.companyName.trim(),
        contactPerson: data.contactPerson?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        addressLine1: data.addressLine1?.trim() || null,
        addressLine2: data.addressLine2?.trim() || null,
        country: data.country?.trim() || null,
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
router.put('/:id', authenticate, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const allowed =
    req.user?.roles.some(r => ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR'].includes(r.toUpperCase())) ||
    req.user?.permissions.includes('settings:manage');
  if (allowed) {
    return next();
  }
  res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied: missing permission to update customers' });
}, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
