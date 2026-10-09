import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { calculateInvoiceTotals, toDecimal } from '../../utils/decimal.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

const router = Router();

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().or(z.string()).refine(v => Number(v) > 0, 'Quantity must be positive'),
  unitOfMeasure: z.string().default('KG'),
  unitPrice: z.number().or(z.string()).refine(v => Number(v) > 0, 'Unit price must be positive')
});

const createInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  issueDate: z.string(), // ISO date string
  dueDate: z.string().optional().nullable(),
  paymentTerms: z.string().default('100% Advance Payment'),
  bankAccountId: z.string().uuid().optional().nullable(),
  sourceInvoiceRef: z.string().optional().nullable(),
  lines: z.array(lineItemSchema).min(1, 'At least one line item required')
});

// Helper to generate next unique invoice number: e.g. PI-2026-0001
async function generateNextInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PI-${currentYear}-`;
  const count = await prisma.invoice.count();
  const nextNum = (count + 1).toString().padStart(4, '0');
  const candidate = `${prefix}${nextNum}`;

  // Check uniqueness
  const exists = await prisma.invoice.findUnique({ where: { invoiceNumber: candidate } });
  if (exists) {
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }
  return candidate;
}

// GET /api/invoices
router.get('/', authenticate, requirePermission('invoice:view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, paymentStatus, customerId, search } = req.query;
    const where: any = {};

    if (status) where.status = String(status);
    if (paymentStatus) where.paymentStatus = String(paymentStatus);
    if (customerId) where.customerId = String(customerId);
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: String(search) } },
        { sourceInvoiceRef: { contains: String(search) } },
        { customer: { companyName: { contains: String(search) } } }
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        lines: true,
        paymentAllocations: true,
        shipmentInvoices: {
          include: { shipment: true }
        }
      },
      orderBy: { issueDate: 'desc' }
    });

    res.json(invoices);
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices/:id
router.get('/:id', authenticate, requirePermission('invoice:view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        lines: { orderBy: { lineNumber: 'asc' } },
        bankAccount: true,
        snapshots: { orderBy: { issuedAt: 'desc' } },
        paymentAllocations: {
          include: { payment: true },
          orderBy: { allocatedAt: 'desc' }
        },
        shipmentInvoices: {
          include: { shipment: true }
        }
      }
    });

    if (!invoice) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }

    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices
router.post('/', authenticate, requirePermission('invoice:create_draft'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createInvoiceSchema.parse(req.body);

    // Verify customer exists
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) {
      res.status(400).json({ error: 'INVALID_CUSTOMER', message: 'Selected customer does not exist' });
      return;
    }

    // Server-side calculation of line totals and grand totals
    const calc = calculateInvoiceTotals(data.lines);
    const invoiceNumber = await generateNextInvoiceNumber();

    // Default primary bank account if none passed
    let bankAccountId = data.bankAccountId;
    if (!bankAccountId) {
      const primaryBank = await prisma.bankAccount.findFirst({ where: { isPrimary: true } });
      if (primaryBank) bankAccountId = primaryBank.id;
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          customerId: data.customerId,
          invoiceNumber,
          sourceInvoiceRef: data.sourceInvoiceRef || null,
          issueDate: new Date(data.issueDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          paymentTerms: data.paymentTerms,
          bankAccountId: bankAccountId || null,
          subtotal: calc.subtotal.toNumber(),
          taxAmount: calc.taxAmount.toNumber(),
          totalAmount: calc.grandTotal.toNumber(),
          status: 'DRAFT',
          paymentStatus: 'UNPAID',
          lines: {
            create: calc.lines.map(l => ({
              lineNumber: l.lineNumber,
              description: l.description,
              quantity: l.quantity.toNumber(),
              unitOfMeasure: l.unitOfMeasure,
              unitPrice: l.unitPrice.toNumber(),
              lineTotal: l.lineTotal.toNumber()
            }))
          }
        },
        include: { lines: true, customer: true }
      });

      return created;
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'INVOICE_DRAFT_CREATED',
      entityType: 'INVOICE',
      entityId: invoice.id,
      newValues: { invoiceNumber, totalAmount: calc.grandTotal.toFixed(2) },
      ipAddress: req.ip
    });

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

// PUT /api/invoices/:id (Draft invoices only)
router.put('/:id', authenticate, requirePermission('invoice:create_draft'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lines: true }
    });

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }

    if (existing.status !== 'DRAFT') {
      res.status(400).json({
        error: 'IMMUTABLE_INVOICE',
        message: `Cannot edit invoice in ${existing.status} status. Issued invoices are immutable.`
      });
      return;
    }

    const data = createInvoiceSchema.parse(req.body);
    const calc = calculateInvoiceTotals(data.lines);

    const updated = await prisma.$transaction(async (tx) => {
      // Delete old lines
      await tx.invoiceLine.deleteMany({ where: { invoiceId: existing.id } });

      return tx.invoice.update({
        where: { id: existing.id },
        data: {
          customerId: data.customerId,
          issueDate: new Date(data.issueDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          paymentTerms: data.paymentTerms,
          bankAccountId: data.bankAccountId || existing.bankAccountId,
          sourceInvoiceRef: data.sourceInvoiceRef || existing.sourceInvoiceRef,
          subtotal: calc.subtotal.toNumber(),
          taxAmount: calc.taxAmount.toNumber(),
          totalAmount: calc.grandTotal.toNumber(),
          lines: {
            create: calc.lines.map(l => ({
              lineNumber: l.lineNumber,
              description: l.description,
              quantity: l.quantity.toNumber(),
              unitOfMeasure: l.unitOfMeasure,
              unitPrice: l.unitPrice.toNumber(),
              lineTotal: l.lineTotal.toNumber()
            }))
          }
        },
        include: { lines: true, customer: true }
      });
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'INVOICE_DRAFT_UPDATED',
      entityType: 'INVOICE',
      entityId: updated.id,
      newValues: { invoiceNumber: updated.invoiceNumber, totalAmount: calc.grandTotal.toFixed(2) },
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices/:id/issue (Issue and freeze snapshot)
router.post('/:id/issue', authenticate, requirePermission('invoice:issue'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        lines: { orderBy: { lineNumber: 'asc' } },
        bankAccount: true
      }
    });

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }

    if (existing.status === 'ISSUED') {
      res.status(400).json({ error: 'ALREADY_ISSUED', message: 'Invoice has already been issued' });
      return;
    }
    if (existing.status === 'VOID') {
      res.status(400).json({ error: 'INVOICE_VOID', message: 'Cannot issue a voided invoice' });
      return;
    }

    // Freeze snapshot data
    const snapshotPayload = {
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      sourceInvoiceRef: existing.sourceInvoiceRef,
      issueDate: existing.issueDate,
      dueDate: existing.dueDate,
      paymentTerms: existing.paymentTerms,
      customer: {
        companyName: existing.customer.companyName,
        contactPerson: existing.customer.contactPerson,
        addressLine1: existing.customer.addressLine1,
        addressLine2: existing.customer.addressLine2,
        country: existing.customer.country,
        email: existing.customer.email
      },
      lines: existing.lines.map(l => ({
        lineNumber: l.lineNumber,
        description: l.description,
        quantity: l.quantity,
        unitOfMeasure: l.unitOfMeasure,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal
      })),
      totalAmount: existing.totalAmount,
      bankAccount: existing.bankAccount ? {
        bankName: existing.bankAccount.bankName,
        beneficiaryName: existing.bankAccount.beneficiaryName,
        accountNumberMasked: existing.bankAccount.accountNumberMasked,
        swiftCode: existing.bankAccount.swiftCode,
        correspondentBank: existing.bankAccount.correspondentBank,
        correspondentSwift: existing.bankAccount.correspondentSwift
      } : null,
      issuedAt: new Date().toISOString(),
      issuedBy: req.user!.email
    };

    const issued = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: existing.id },
        data: {
          status: 'ISSUED',
          issuedAt: new Date()
        },
        include: { customer: true, lines: true }
      });

      await tx.invoiceSnapshot.create({
        data: {
          invoiceId: existing.id,
          snapshotJson: JSON.stringify(snapshotPayload),
          issuedBy: req.user!.email
        }
      });

      return inv;
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'INVOICE_ISSUED',
      entityType: 'INVOICE',
      entityId: issued.id,
      newValues: { invoiceNumber: issued.invoiceNumber, issuedAt: issued.issuedAt },
      ipAddress: req.ip
    });

    res.json(issued);
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices/:id/void
router.post('/:id/void', authenticate, requirePermission('invoice:void'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reason } = z.object({ reason: z.string().min(5, 'Mandatory void reason required') }).parse(req.body);

    const existing = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { paymentAllocations: true }
    });

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }

    if (existing.status === 'VOID') {
      res.status(400).json({ error: 'ALREADY_VOID', message: 'Invoice is already voided' });
      return;
    }

    if (existing.paymentAllocations.length > 0) {
      res.status(400).json({
        error: 'HAS_PAYMENTS',
        message: 'Cannot void an invoice with active payment allocations. Reallocate or reverse payments first.'
      });
      return;
    }

    const voided = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        status: 'VOID',
        voidedAt: new Date(),
        voidReason: reason
      }
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'INVOICE_VOIDED',
      entityType: 'INVOICE',
      entityId: voided.id,
      newValues: { reason, voidedAt: voided.voidedAt },
      ipAddress: req.ip
    });

    res.json(voided);
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices/:id/pdf-data (Formatted printable invoice layout)
router.get('/:id/pdf-data', authenticate, requirePermission('invoice:view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        lines: { orderBy: { lineNumber: 'asc' } },
        bankAccount: true,
        snapshots: { orderBy: { issuedAt: 'desc' } }
      }
    });

    if (!invoice) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }

    // Company profile
    const profile = await prisma.companyProfile.findFirst() || {
      orgName: 'AQ Companies',
      legalName: 'SKY ARIANA LTD',
      email: 'info@skyariana.com',
      website: 'www.skyariana.com'
    };

    const printableData = {
      invoiceNumber: invoice.invoiceNumber,
      sourceInvoiceRef: invoice.sourceInvoiceRef,
      issueDate: invoice.issueDate.toISOString().split('T')[0],
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : null,
      paymentTerms: invoice.paymentTerms,
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
      company: {
        orgName: profile.orgName,
        legalName: profile.legalName,
        email: profile.email,
        website: profile.website
      },
      customer: {
        companyName: invoice.customer.companyName,
        addressLine1: invoice.customer.addressLine1 || '',
        addressLine2: invoice.customer.addressLine2 || '',
        country: invoice.customer.country || ''
      },
      lines: invoice.lines.map(l => ({
        lineNumber: l.lineNumber,
        description: l.description,
        quantity: Number(l.quantity).toLocaleString() + ' ' + l.unitOfMeasure,
        unitPrice: '$' + Number(l.unitPrice).toFixed(2),
        lineTotal: '$' + Number(l.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      })),
      subtotal: '$' + Number(invoice.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      grandTotal: '$' + Number(invoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      bankingDetails: invoice.bankAccount ? {
        bankName: invoice.bankAccount.bankName,
        beneficiaryName: invoice.bankAccount.beneficiaryName,
        accountNumber: invoice.bankAccount.accountNumberMasked,
        swiftCode: invoice.bankAccount.swiftCode,
        correspondentBank: invoice.bankAccount.correspondentBank,
        correspondentSwift: invoice.bankAccount.correspondentSwift
      } : null
    };

    res.json(printableData);
  } catch (err) {
    next(err);
  }
});

export default router;
