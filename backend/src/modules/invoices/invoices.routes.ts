import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { Decimal, calculateInvoiceTotals, toDecimal, calculateLedgerRunningBalances } from '../../utils/decimal.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';
import { receiptsService } from '../receipts/receipts.service.js';
import type { Prisma, Invoice as PrismaInvoice } from '@prisma/client';

const router = Router();

type TxClient = Prisma.TransactionClient;

const lineItemSchema = z.object({
  description: z.string().min(1),
  cartonCount: z.number().or(z.string()).optional().nullable(),
  packagingKgPerCarton: z.number().or(z.string()).optional().nullable(),
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
  remittanceProfileId: z.string().uuid().optional().nullable(),
  sourceInvoiceRef: z.string().optional().nullable(),
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELED']).optional(),
  lines: z.array(lineItemSchema).min(1, 'At least one line item required')
});

// Helper to generate next unique invoice number: e.g. PI-2026-0009.
// Zero-padded numbers order lexically, so the highest number is simply the
// last one in descending order — no need to scan every invoice of the year.
async function generateNextInvoiceNumber(tx: TxClient | typeof prisma = prisma): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PI-${currentYear}-`;
  const latest = await tx.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true }
  });
  let maxSeq = 0;
  if (latest) {
    const num = parseInt(latest.invoiceNumber.slice(prefix.length), 10);
    if (!isNaN(num)) maxSeq = num;
  }
  const nextNum = (maxSeq + 1).toString().padStart(4, '0');
  return `${prefix}${nextNum}`;
}

/**
 * Derives paid/remaining figures from payment allocations (amount + SWIFT fee
 * per allocation = gross allocated). Keeps the Prisma backend's responses in
 * the same shape the frontend already consumes from the cloud engine.
 */
function computePaymentTotals(invoice: Pick<PrismaInvoice, 'totalAmount'> & { paymentAllocations?: Array<{ amount: any; swiftBankFee?: any }> }) {
  const invoiceTotal = toDecimal(invoice.totalAmount);
  const paid = (invoice.paymentAllocations || []).reduce(
    (sum, a) => sum.plus(toDecimal(a.amount)).plus(toDecimal(a.swiftBankFee || 0)),
    new Decimal(0)
  );
  const paidCapped = Decimal.min(paid, invoiceTotal);
  return {
    paidAmount: paidCapped.toDecimalPlaces(2).toNumber(),
    remainingBalance: invoiceTotal.minus(paidCapped).toDecimalPlaces(2).toNumber()
  };
}

function enrichInvoice<T extends { totalAmount: any; paymentAllocations?: any[] }>(invoice: T): T & { paidAmount: number; remainingBalance: number } {
  const totals = computePaymentTotals(invoice as any);
  return { ...invoice, ...totals };
}

// GET /api/invoices
router.get('/', authenticate, requirePermission('invoice:view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, paymentStatus, customerId, search } = req.query;
    const where: any = {};

    const cleanParam = (val: any) => {
      if (!val) return undefined;
      const str = String(val).trim();
      if (str === '' || str === 'undefined' || str === 'null' || str === 'ALL') return undefined;
      return str;
    };

    const sStatus = cleanParam(status);
    if (sStatus) where.status = sStatus;

    const sPaymentStatus = cleanParam(paymentStatus);
    if (sPaymentStatus) where.paymentStatus = sPaymentStatus;

    const sCustomerId = cleanParam(customerId);
    if (sCustomerId) where.customerId = sCustomerId;

    const sSearch = cleanParam(search);
    if (sSearch) {
      where.OR = [
        { invoiceNumber: { contains: sSearch } },
        { sourceInvoiceRef: { contains: sSearch } },
        { customer: { companyName: { contains: sSearch } } }
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        lines: true,
        bankAccount: true,
        remittanceProfile: true,
        bankSnapshot: true,
        paymentAllocations: true,
        shipmentInvoices: {
          include: { shipment: true }
        }
      },
      orderBy: [
        { issueDate: 'desc' },
        { invoiceNumber: 'desc' }
      ]
    });

    res.json(invoices.map(enrichInvoice));
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
        remittanceProfile: true,
        bankSnapshot: true,
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

    let enrichedBankSnapshot = invoice.bankSnapshot;
    if (invoice.bankSnapshot && (invoice.bankSnapshot as any).snapshotJson) {
      try {
        const parsed = JSON.parse((invoice.bankSnapshot as any).snapshotJson);
        enrichedBankSnapshot = {
          ...invoice.bankSnapshot,
          ...parsed,
          beneficiaryBank: parsed.beneficiaryBank?.name || parsed.beneficiaryBank,
          beneficiaryName: parsed.beneficiary?.name || parsed.beneficiaryName,
          beneficiaryAccount: parsed.beneficiary?.accountNumber || parsed.beneficiaryAccount,
          correspondentBank: parsed.correspondentBank?.name || parsed.correspondentBank,
          correspondentSwift: parsed.correspondentBank?.swiftBic || parsed.correspondentSwift,
          correspondentAccount: parsed.correspondentBank?.accountNumber || parsed.correspondentAccount,
          intermediaryBank: parsed.intermediaryBank?.name || parsed.intermediaryBank,
          intermediarySwift: parsed.intermediaryBank?.swiftBic || parsed.intermediarySwift
        } as any;
      } catch (e) {}
    }

    res.json(enrichInvoice({
      ...invoice,
      bankSnapshot: enrichedBankSnapshot
    }));
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

    // Default active remittance profile if none passed
    let remittanceProfileId = data.remittanceProfileId;
    if (!remittanceProfileId) {
      const defaultProfile = await prisma.remittanceProfile.findFirst({
        where: { isDefault: true, isActive: true }
      });
      if (defaultProfile) remittanceProfileId = defaultProfile.id;
    }

    // Default primary bank account if none passed
    let bankAccountId = data.bankAccountId;
    if (!bankAccountId) {
      if (remittanceProfileId) {
        const prof = await prisma.remittanceProfile.findUnique({ where: { id: remittanceProfileId } });
        if (prof) bankAccountId = prof.bankAccountId;
      }
      if (!bankAccountId) {
        const primaryBank = await prisma.bankAccount.findFirst({ where: { isPrimary: true } });
        if (primaryBank) bankAccountId = primaryBank.id;
      }
    }

    const invoice = await prisma.$transaction(async (tx) => {
      // Generated inside the transaction so concurrent creates cannot collide
      const invoiceNumber = await generateNextInvoiceNumber(tx);
      const created = await tx.invoice.create({
        data: {
          customerId: data.customerId,
          invoiceNumber,
          sourceInvoiceRef: data.sourceInvoiceRef || null,
          issueDate: new Date(data.issueDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          paymentTerms: data.paymentTerms,
          bankAccountId: bankAccountId || null,
          remittanceProfileId: remittanceProfileId || null,
          subtotal: calc.subtotal.toNumber(),
          taxAmount: calc.taxAmount.toNumber(),
          totalAmount: calc.grandTotal.toNumber(),
          status: 'DRAFT',
          paymentStatus: 'UNPAID',
          lines: {
            create: calc.lines.map(l => ({
              lineNumber: l.lineNumber,
              description: l.description,
              cartonCount: l.cartonCount,
              packagingKgPerCarton: l.packagingKgPerCarton ? l.packagingKgPerCarton.toNumber() : null,
              quantity: l.quantity.toNumber(),
              unitOfMeasure: l.unitOfMeasure,
              unitPrice: l.unitPrice.toNumber(),
              lineTotal: l.lineTotal.toNumber()
            }))
          }
        },
        include: { lines: true, customer: true, bankAccount: true, remittanceProfile: true }
      });

      return created;
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'INVOICE_DRAFT_CREATED',
      entityType: 'INVOICE',
      entityId: invoice.id,
      newValues: { invoiceNumber: invoice.invoiceNumber, totalAmount: calc.grandTotal.toFixed(2), remittanceProfileId },
      ipAddress: req.ip
    });

    res.status(201).json(enrichInvoice({ ...invoice, paymentAllocations: [] }));
  } catch (err) {
    next(err);
  }
});

// PUT /api/invoices/:id (Draft & Issued invoice edits by Admin / Finance Manager)
router.put('/:id', authenticate, requirePermission('invoice:create_draft'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lines: true, customer: true, bankAccount: true, remittanceProfile: true }
    });

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }

    if (existing.status === 'VOID') {
      res.status(400).json({
        error: 'VOID_INVOICE',
        message: 'Cannot edit an invoice in VOID status.'
      });
      return;
    }

    const userRoles = req.user?.roles || [];
    const isAuthorizedManager = userRoles.some(r => ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR'].includes(r.toUpperCase()));

    if (existing.status !== 'DRAFT' && !isAuthorizedManager) {
      res.status(403).json({
        error: 'IMMUTABLE_INVOICE',
        message: `Only System Administrators and Finance Managers may edit invoices in ${existing.status} status.`
      });
      return;
    }

    const data = createInvoiceSchema.parse(req.body);
    const calc = calculateInvoiceTotals(data.lines);

    const updated = await prisma.$transaction(async (tx) => {
      // Delete old lines
      await tx.invoiceLine.deleteMany({ where: { invoiceId: existing.id } });

      const inv = await tx.invoice.update({
        where: { id: existing.id },
        data: {
          customerId: data.customerId,
          issueDate: new Date(data.issueDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          paymentTerms: data.paymentTerms,
          paymentStatus: data.paymentStatus || existing.paymentStatus,
          bankAccountId: data.bankAccountId || existing.bankAccountId,
          remittanceProfileId: data.remittanceProfileId !== undefined ? data.remittanceProfileId : existing.remittanceProfileId,
          sourceInvoiceRef: data.sourceInvoiceRef || existing.sourceInvoiceRef,
          subtotal: calc.subtotal.toNumber(),
          taxAmount: calc.taxAmount.toNumber(),
          totalAmount: calc.grandTotal.toNumber(),
          lines: {
            create: calc.lines.map(l => ({
              lineNumber: l.lineNumber,
              description: l.description,
              cartonCount: l.cartonCount,
              packagingKgPerCarton: l.packagingKgPerCarton ? l.packagingKgPerCarton.toNumber() : null,
              quantity: l.quantity.toNumber(),
              unitOfMeasure: l.unitOfMeasure,
              unitPrice: l.unitPrice.toNumber(),
              lineTotal: l.lineTotal.toNumber()
            }))
          }
        },
        include: { lines: true, customer: true, bankAccount: true, remittanceProfile: true, paymentAllocations: true }
      });

      return inv;
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: existing.status === 'DRAFT' ? 'INVOICE_DRAFT_UPDATED' : 'INVOICE_UPDATED',
      entityType: 'INVOICE',
      entityId: updated.id,
      newValues: { invoiceNumber: updated.invoiceNumber, totalAmount: calc.grandTotal.toFixed(2), status: existing.status },
      ipAddress: req.ip
    });

    res.json(enrichInvoice(updated));
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices/:id/record-payment (Record payment, generate optional receipt & ledger entry)
const recordPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  swiftFeeDeducted: z.number().min(0).default(0),
  paymentDate: z.string().optional(),
  bankReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createReceiptAndLedger: z.boolean().default(true)
});

router.post('/:id/record-payment', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = recordPaymentSchema.parse(req.body);
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { customer: true, lines: true }
    });

    if (!invoice) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }
    if (invoice.status === 'VOID') {
      res.status(400).json({ error: 'INVOICE_VOID', message: 'Cannot record a payment against a voided invoice' });
      return;
    }

    const payDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
    const payAmount = toDecimal(data.amount);
    const swiftFee = toDecimal(data.swiftFeeDeducted);

    if (swiftFee.gte(payAmount)) {
      res.status(400).json({ error: 'INVALID_FEE', message: 'SWIFT fee cannot be greater than or equal to the payment amount' });
      return;
    }

    const netCredited = swiftFee.gt(0) ? payAmount.minus(swiftFee) : payAmount;

    let newPaymentStatus = 'PAID';

    const result = await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction so two concurrent payments cannot both
      // allocate against the same previously-paid figure (double allocation).
      const current = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: { paymentAllocations: true }
      });
      if (!current) {
        throw Object.assign(new Error('Invoice not found'), { status: 404 });
      }

      // Allocation basis matches the payments module: amount + SWIFT fee per
      // allocation equals the gross amount credited against the invoice.
      const currentAllocated = current.paymentAllocations.reduce(
        (sum, a) => sum.plus(toDecimal(a.amount)).plus(toDecimal(a.swiftBankFee || 0)),
        new Decimal(0)
      );
      const invoiceTotal = toDecimal(current.totalAmount);
      const newTotalAllocated = currentAllocated.plus(payAmount);

      if (newTotalAllocated.gt(invoiceTotal.plus(new Decimal('0.005')))) {
        const remaining = invoiceTotal.minus(currentAllocated).toDecimalPlaces(2);
        throw Object.assign(
          new Error(`Payment of $${payAmount.toFixed(2)} exceeds the outstanding balance of $${remaining.toFixed(2)}`),
          { status: 400, code: 'OVERPAYMENT' }
        );
      }

      newPaymentStatus = newTotalAllocated.gte(invoiceTotal) ? 'PAID' : 'PARTIALLY_PAID';

      // 1. Update invoice paymentStatus and status if draft
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paymentStatus: newPaymentStatus,
          status: current.status === 'DRAFT' ? 'ISSUED' : current.status
        },
        include: { lines: true, customer: true, bankAccount: true, remittanceProfile: true, paymentAllocations: true }
      });

      let createdPayment = null;
      let createdReceipt = null;
      let createdLedger = null;

      if (data.createReceiptAndLedger) {
        // Find USD financial account
        const finAccount = await tx.financialAccount.findFirst({ where: { currency: 'USD' } });
        const finAccountId = finAccount ? finAccount.id : (await tx.financialAccount.findFirst())?.id;

        if (finAccountId) {
          // Create Payment record
          createdPayment = await tx.payment.create({
            data: {
              customerId: invoice.customerId,
              financialAccountId: finAccountId,
              paymentDate: payDate,
              reference: data.bankReference || `PMT-${invoice.invoiceNumber}`,
              paymentMethod: 'WIRE_TRANSFER',
              totalAmount: payAmount.toNumber(),
              allocatedAmount: payAmount.toNumber(),
              unallocatedAmount: 0,
              currency: 'USD',
              notes: data.notes || `Payment for invoice ${invoice.invoiceNumber}`,
              allocations: {
                create: {
                  invoiceId: invoice.id,
                  amount: netCredited.toNumber(),
                  swiftBankFee: swiftFee.toNumber(),
                  notes: data.notes || null
                }
              }
            }
          });

          // Create Ledger Credit Transaction (Credited with Net Wire Amount)
          createdLedger = await tx.ledgerTransaction.create({
            data: {
              financialAccountId: finAccountId,
              effectiveDate: payDate,
              reference: data.bankReference || `AUB-${invoice.invoiceNumber}`,
              description: `Payment received for ${invoice.invoiceNumber} - ${invoice.customer.companyName}`,
              category: 'CREDIT',
              creditAmount: netCredited.toNumber(),
              debitAmount: 0,
              currency: 'USD',
              notes: swiftFee.gt(0) ? `Gross payment: $${payAmount.toFixed(2)} less SWIFT fee: $${swiftFee.toFixed(2)}` : null
            }
          });

          // Create Official Deposit Receipt
          createdReceipt = await receiptsService.createReceipt({
            paymentId: createdPayment.id,
            ledgerTransactionId: createdLedger.id,
            payerName: invoice.customer.companyName,
            receivingAccountName: 'Afghan United Bank Operating Account',
            receivingAccountMasked: '101502******0472',
            amount: netCredited.toNumber(),
            grossAmount: payAmount.toNumber(),
            swiftFeeAmount: swiftFee.toNumber(),
            currency: 'USD',
            paymentMethod: 'WIRE_TRANSFER',
            referenceNumber: data.bankReference || undefined,
            purpose: `Settlement for Proforma Invoice ${invoice.invoiceNumber}`,
            invoiceId: invoice.id,
            issueDate: payDate,
            notes: data.notes || undefined,
            createdById: req.user?.userId
          }, tx);

          // Recalculate deterministic running balances across all transactions
          const openingBalance = finAccount ? finAccount.openingBalance : 0;
          const allTxs = await tx.ledgerTransaction.findMany({
            orderBy: [{ effectiveDate: 'asc' }, { postedAt: 'asc' }, { id: 'asc' }]
          });
          const calculated = calculateLedgerRunningBalances(openingBalance, allTxs);

          for (const c of calculated) {
            await tx.ledgerTransaction.update({
              where: { id: c.id },
              data: { runningBalance: c.runningBalance.toNumber() }
            });
            if (c.id === createdLedger.id) {
              (createdLedger as any).runningBalance = c.runningBalance.toNumber();
            }
          }
        }
      }

      return { updatedInvoice, createdPayment, createdReceipt, createdLedger };
    });

    // Re-read so the response reflects the allocation created above
    const freshInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { lines: true, customer: true, paymentAllocations: true }
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'INVOICE_PAYMENT_RECORDED',
      entityType: 'INVOICE',
      entityId: invoice.id,
      newValues: {
        amount: data.amount,
        netCredited: netCredited.toNumber(),
        swiftFeeDeducted: data.swiftFeeDeducted,
        newStatus: newPaymentStatus,
        receiptNumber: result.createdReceipt?.receiptNumber
      },
      ipAddress: req.ip
    });

    res.json({
      ...result,
      updatedInvoice: freshInvoice ? enrichInvoice(freshInvoice) : result.updatedInvoice
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/invoices/:id/toggle-payment (Quick toggle or update payment status)
router.patch('/:id/toggle-payment', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }

    const requestedStatus = req.body.paymentStatus;
    let newStatus = 'PAID';
    if (requestedStatus) {
      newStatus = requestedStatus;
    } else {
      newStatus = existing.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID';
    }

    const updated = await prisma.invoice.update({
      where: { id: existing.id },
      data: { paymentStatus: newStatus },
      include: { paymentAllocations: true, lines: true, customer: true }
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'INVOICE_PAYMENT_STATUS_TOGGLED',
      entityType: 'INVOICE',
      entityId: updated.id,
      newValues: { oldStatus: existing.paymentStatus, newStatus },
      ipAddress: req.ip
    });

    res.json(enrichInvoice(updated));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/invoices/:id (Delete invoice & cleanup child allocations)
router.delete('/:id', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lines: true, paymentAllocations: true }
    });

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.receipt.updateMany({ where: { invoiceId: existing.id }, data: { invoiceId: null } });
      await tx.shipmentInvoice.deleteMany({ where: { invoiceId: existing.id } });
      await tx.paymentAllocation.deleteMany({ where: { invoiceId: existing.id } });
      await tx.invoiceBankSnapshot.deleteMany({ where: { invoiceId: existing.id } });
      await tx.invoiceSnapshot.deleteMany({ where: { invoiceId: existing.id } });
      await tx.invoiceLine.deleteMany({ where: { invoiceId: existing.id } });
      await tx.invoice.delete({ where: { id: existing.id } });
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'INVOICE_DELETED',
      entityType: 'INVOICE',
      entityId: existing.id,
      newValues: { invoiceNumber: existing.invoiceNumber },
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Invoice ${existing.invoiceNumber} deleted successfully` });
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
        bankAccount: true,
        remittanceProfile: true
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

    // Resolve remittance profile
    let profile = existing.remittanceProfile;
    if (!profile && existing.remittanceProfileId) {
      profile = await prisma.remittanceProfile.findUnique({
        where: { id: existing.remittanceProfileId }
      });
    }
    if (!profile) {
      profile = await prisma.remittanceProfile.findFirst({
        where: { isDefault: true, isActive: true }
      });
    }

    // Build immutable bank snapshot data (WITHOUT sensitive internal CIF numbers)
    const bankSnapshotData = profile ? {
      profileId: profile.id,
      profileType: profile.profileType,
      name: profile.name,
      currency: 'USD',
      title: 'BANK / PAYMENT INSTRUCTIONS - USD',
      beneficiary: {
        name: profile.beneficiaryName || 'SKY ARIANA LTD',
        accountNumber: profile.beneficiaryAccount || '101502USD2940472',
        bankName: profile.beneficiaryBank || 'AFGHAN UNITED BANK',
        address: profile.beneficiaryBankAddress || 'AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul',
        swiftBic: profile.beneficiarySwift || 'AFGUAFKAXXX',
        swiftField57A: profile.swiftField57A || 'AFGUAFKAXXX',
        swiftField59A: profile.swiftField59A || 'Beneficiary account in field 59A; AFGUAFKAXXX in field 57A.',
        mt103Note: 'Beneficiary account in field 59A; AFGUAFKAXXX in field 57A.'
      },
      internationalRouting: {
        correspondentBank: 'AL SALAM BANK BAHRAIN',
        swiftCode: 'ALSABHBMXXX',
        aubAccountWithCorrespondent: 'BH61ALSA00500951200102',
        intermediaryAccount: '400758954',
        location: 'Sanabis, Bahrain',
        intermediaryBank: 'JPMorgan Chase Bank, New York',
        intermediarySwift: 'CHASUS33',
        mt103Note: 'ALSABHBM in field 56A; intermediary bank mandatory in field 54A.'
      },
      localCorrespondent: {
        bank: '(DAB) DA AFGHANISTAN BANK',
        swiftCode: 'AFGBAFKA',
        accountNumber: '3000205027231',
        location: 'Ibni-sina Watt, Kabul'
      },
      importantPaymentNote: {
        title: 'IMPORTANT USD PAYMENT NOTE',
        text: 'NOTE: For all USD payments, it is mandatory to include the following correspondent bank details in the payment instructions:\nCORRESPONDENT BANK: AL SALAM BANK BAHRAIN\nSWIFT CODE: ALSABHBMXXX\nA/C NO. WITH INTERMEDIARY BANK: 400758954\nLOCATION: SANABIS, BAHRAIN\nPlease mention “ALSABHBM” in Field 56A of the MT103.'
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
        swiftField54A: profile.swiftField54A || 'Intermediary bank mandatory in field 54A'
      } : null,
      issuedAt: new Date().toISOString()
    } : null;

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
        cartonCount: l.cartonCount,
        packagingKgPerCarton: l.packagingKgPerCarton,
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
      remittanceProfile: bankSnapshotData,
      issuedAt: new Date().toISOString(),
      issuedBy: req.user!.email
    };

    const issued = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: existing.id },
        data: {
          status: 'ISSUED',
          issuedAt: new Date(),
          remittanceProfileId: profile ? profile.id : existing.remittanceProfileId
        },
        include: { customer: true, lines: true, bankAccount: true, remittanceProfile: true }
      });

      // Save dedicated bank snapshot
      if (profile && bankSnapshotData) {
        await tx.invoiceBankSnapshot.upsert({
          where: { invoiceId: existing.id },
          update: {
            remittanceProfileId: profile.id,
            profileType: profile.profileType,
            profileName: profile.name,
            snapshotJson: JSON.stringify(bankSnapshotData)
          },
          create: {
            invoiceId: existing.id,
            remittanceProfileId: profile.id,
            profileType: profile.profileType,
            profileName: profile.name,
            snapshotJson: JSON.stringify(bankSnapshotData)
          }
        });
      }

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

// POST /api/invoices/:id/void (Mandatory reason + Administrator/Finance Manager authorization)
router.post('/:id/void', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
        remittanceProfile: true,
        bankSnapshot: true,
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
      website: 'www.skyariana.com',
      address: 'Zarghona Maidan, Shahr-e-Now, Kabul, Afghanistan',
      phone: '+93 20 220 1234'
    };

    // Parse snapshot if invoice was issued, otherwise use attached or default profile
    let bankData: any = null;
    let isSnapshot = false;
    if (invoice.bankSnapshot && (invoice.bankSnapshot as any).snapshotJson) {
      try {
        bankData = JSON.parse((invoice.bankSnapshot as any).snapshotJson);
        isSnapshot = true;
      } catch (e) {}
    }
    if (!bankData && invoice.remittanceProfile) {
      bankData = invoice.remittanceProfile;
    }
    if (!bankData) {
      bankData = await prisma.remittanceProfile.findFirst({
        where: { isDefault: true, isActive: true }
      });
    }

    const defaultBankAddress = 'AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul';
    const isIntl = !bankData || bankData.profileType === 'INTERNATIONAL' || (bankData.profile && bankData.profile.profileType === 'INTERNATIONAL');

    const paymentInstructions = {
      title: 'BANK / PAYMENT INSTRUCTIONS - USD',
      isSnapshot,
      profileType: isIntl ? 'INTERNATIONAL' : 'LOCAL',
      beneficiary: {
        name: 'SKY ARIANA LTD',
        accountNumber: '101502USD2940472',
        bankName: 'AFGHAN UNITED BANK',
        bankAddress: bankData?.beneficiary?.address || bankData?.beneficiaryBankAddress || bankData?.beneficiaryBank?.address || defaultBankAddress,
        swiftCode: 'AFGUAFKAXXX',
        mt103Note: 'Beneficiary account in field 59A; AFGUAFKAXXX in field 57A.'
      },
      internationalRouting: {
        correspondentBank: 'AL SALAM BANK BAHRAIN',
        swiftCode: 'ALSABHBMXXX',
        aubAccountWithCorrespondent: 'BH61ALSA00500951200102',
        intermediaryAccount: '400758954',
        location: 'Sanabis, Bahrain',
        intermediaryBank: 'JPMorgan Chase Bank, New York',
        intermediarySwift: 'CHASUS33',
        mt103Note: 'ALSABHBM in field 56A; intermediary bank mandatory in field 54A.'
      },
      localCorrespondent: {
        bank: '(DAB) DA AFGHANISTAN BANK',
        swiftCode: 'AFGBAFKA',
        accountNumber: '3000205027231',
        location: 'Ibni-sina Watt, Kabul'
      },
      importantPaymentNote: {
        title: 'IMPORTANT USD PAYMENT NOTE',
        text: 'NOTE: For all USD payments, it is mandatory to include the following correspondent bank details in the payment instructions:\nCORRESPONDENT BANK: AL SALAM BANK BAHRAIN\nSWIFT CODE: ALSABHBMXXX\nA/C NO. WITH INTERMEDIARY BANK: 400758954\nLOCATION: SANABIS, BAHRAIN\nPlease mention “ALSABHBM” in Field 56A of the MT103.'
      }
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
        website: profile.website,
        address: (profile as any).address || 'Zarghona Maidan, Shahr-e-Now, Kabul, Afghanistan',
        phone: (profile as any).phone || '+93 20 220 1234'
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
        cartonCount: l.cartonCount,
        packagingKgPerCarton: l.packagingKgPerCarton ? Number(l.packagingKgPerCarton).toFixed(2) : null,
        cartonDisplay: l.cartonCount ? `${Number(l.cartonCount).toLocaleString()} CTNS` : null,
        quantity: Number(l.quantity).toLocaleString() + ' ' + l.unitOfMeasure,
        unitPrice: '$' + Number(l.unitPrice).toFixed(4),
        lineTotal: '$' + Number(l.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      })),
      subtotal: '$' + Number(invoice.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      grandTotal: '$' + Number(invoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      paymentInstructions,
      bankSnapshot: bankData,
      remittanceProfile: invoice.remittanceProfile || bankData,
      bankingDetails: {
        bankName: 'AFGHAN UNITED BANK',
        beneficiaryName: 'SKY ARIANA LTD',
        accountNumber: '101502USD2940472',
        swiftCode: 'AFGUAFKAXXX',
        bankAddress: defaultBankAddress,
        correspondentBank: 'AL SALAM BANK BAHRAIN',
        correspondentSwift: 'ALSABHBMXXX',
        aubAccountWithCorrespondent: 'BH61ALSA00500951200102',
        intermediaryAccount: '400758954',
        correspondentLocation: 'Sanabis, Bahrain',
        intermediaryBank: 'JPMorgan Chase Bank, New York',
        intermediarySwift: 'CHASUS33'
      }
    };

    res.json(printableData);
  } catch (err) {
    next(err);
  }
});

export default router;
