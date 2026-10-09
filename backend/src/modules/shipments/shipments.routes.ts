import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

const router = Router();

const createShipmentSchema = z.object({
  shipmentRef: z.string().min(2),
  containerNumber: z.string().optional().nullable(),
  billOfLading: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
  carrier: z.string().optional().nullable(),
  shipmentDate: z.string().optional().nullable(),
  estimatedArrivalDate: z.string().optional().nullable(),
  actualArrivalDate: z.string().optional().nullable(),
  status: z.enum(['BOOKED', 'AT_ORIGIN_PORT', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'DELIVERED', 'CANCELLED']).default('BOOKED'),
  notes: z.string().optional().nullable(),
  invoiceIds: z.array(z.string().uuid()).optional().default([])
});

const updateStatusSchema = z.object({
  newStatus: z.enum(['BOOKED', 'AT_ORIGIN_PORT', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'DELIVERED', 'CANCELLED']),
  reason: z.string().optional().nullable()
});

// GET /api/shipments
router.get('/', authenticate, requirePermission('shipment:view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, carrier, search } = req.query;
    const where: any = {};
    if (status) where.status = String(status);
    if (carrier) where.carrier = { contains: String(carrier) };
    if (search) {
      where.OR = [
        { shipmentRef: { contains: String(search) } },
        { containerNumber: { contains: String(search) } },
        { billOfLading: { contains: String(search) } },
        { origin: { contains: String(search) } },
        { destination: { contains: String(search) } }
      ];
    }

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        shipmentInvoices: {
          include: {
            invoice: {
              include: { customer: true }
            }
          }
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(shipments);
  } catch (err) {
    next(err);
  }
});

// GET /api/shipments/:id
router.get('/:id', authenticate, requirePermission('shipment:view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: {
        shipmentInvoices: {
          include: {
            invoice: {
              include: { customer: true, lines: true }
            }
          }
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' }
        }
      }
    });

    if (!shipment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Shipment not found' });
      return;
    }

    res.json(shipment);
  } catch (err) {
    next(err);
  }
});

// POST /api/shipments
router.post('/', authenticate, requirePermission('shipment:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createShipmentSchema.parse(req.body);

    // Check unique shipment ref
    const existing = await prisma.shipment.findUnique({ where: { shipmentRef: data.shipmentRef } });
    if (existing) {
      res.status(400).json({ error: 'DUPLICATE_REF', message: `Shipment ref ${data.shipmentRef} already exists` });
      return;
    }

    const shipment = await prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          shipmentRef: data.shipmentRef,
          containerNumber: data.containerNumber || null,
          billOfLading: data.billOfLading || null,
          origin: data.origin || null,
          destination: data.destination || null,
          carrier: data.carrier || null,
          shipmentDate: data.shipmentDate ? new Date(data.shipmentDate) : null,
          estimatedArrivalDate: data.estimatedArrivalDate ? new Date(data.estimatedArrivalDate) : null,
          actualArrivalDate: data.actualArrivalDate ? new Date(data.actualArrivalDate) : null,
          status: data.status,
          notes: data.notes || null,
          statusHistory: {
            create: {
              newStatus: data.status,
              changedBy: req.user!.email,
              reason: 'Initial shipment creation'
            }
          }
        }
      });

      // Link invoices
      for (const invId of data.invoiceIds) {
        await tx.shipmentInvoice.create({
          data: {
            shipmentId: created.id,
            invoiceId: invId
          }
        });
      }

      return created;
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'SHIPMENT_CREATED',
      entityType: 'SHIPMENT',
      entityId: shipment.id,
      newValues: { shipmentRef: shipment.shipmentRef, status: shipment.status },
      ipAddress: req.ip
    });

    res.status(201).json(shipment);
  } catch (err) {
    next(err);
  }
});

// POST /api/shipments/:id/status (Transition status with audit trail)
router.post('/:id/status', authenticate, requirePermission('shipment:manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { newStatus, reason } = updateStatusSchema.parse(req.body);

    const existing = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Shipment not found' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const shp = await tx.shipment.update({
        where: { id: existing.id },
        data: { status: newStatus }
      });

      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: existing.id,
          oldStatus: existing.status,
          newStatus,
          changedBy: req.user!.email,
          reason: reason || 'Status updated via logistics portal'
        }
      });

      return shp;
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'SHIPMENT_STATUS_UPDATED',
      entityType: 'SHIPMENT',
      entityId: updated.id,
      oldValues: { status: existing.status },
      newValues: { status: newStatus, reason },
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
