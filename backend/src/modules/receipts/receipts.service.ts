import { prisma } from '../../prisma.js';
import { generateNextReceiptNumber, numberToWords } from './receipts.util.js';
import { recordAuditEvent } from '../../middleware/audit.js';

export interface CreateReceiptInput {
  paymentId?: string;
  ledgerTransactionId?: string;
  payerName: string;
  receivingAccountName?: string;
  receivingAccountMasked?: string;
  amount: number | string;
  currency?: string;
  paymentMethod?: string;
  referenceNumber?: string | null;
  purpose: string;
  invoiceId?: string | null;
  shipmentId?: string | null;
  notes?: string | null;
  createdById?: string;
}

export const receiptsService = {
  /**
   * Atomically create exactly one receipt linked to an incoming money transaction
   */
  async createReceipt(input: CreateReceiptInput, txClient?: any) {
    const db = txClient || prisma;
    const currency = input.currency || 'USD';
    const numAmount = typeof input.amount === 'string' ? parseFloat(input.amount) : input.amount;
    const words = numberToWords(numAmount, currency);
    const receiptNumber = await generateNextReceiptNumber(db);

    // Default masked bank details if not provided
    const accountName = input.receivingAccountName || 'Afghan United Bank Operating Account';
    const accountMasked = input.receivingAccountMasked || '101502******0472';

    const receipt = await db.receipt.create({
      data: {
        receiptNumber,
        paymentId: input.paymentId || null,
        ledgerTransactionId: input.ledgerTransactionId || null,
        issueDate: new Date(),
        payerName: input.payerName,
        receivingAccountName: accountName,
        receivingAccountMasked: accountMasked,
        amount: numAmount,
        amountInWords: words,
        currency,
        paymentMethod: input.paymentMethod || 'WIRE_TRANSFER',
        referenceNumber: input.referenceNumber || null,
        purpose: input.purpose,
        invoiceId: input.invoiceId || null,
        shipmentId: input.shipmentId || null,
        notes: input.notes || null,
        status: 'ISSUED',
        createdById: input.createdById || null
      },
      include: {
        invoice: true,
        shipment: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    return receipt;
  },

  async getReceipts(filters: {
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { receiptNumber: { contains: q } },
        { payerName: { contains: q } },
        { referenceNumber: { contains: q } },
        { purpose: { contains: q } }
      ];
    }

    if (filters.startDate || filters.endDate) {
      where.issueDate = {};
      if (filters.startDate) where.issueDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.issueDate.lte = new Date(filters.endDate);
    }

    return prisma.receipt.findMany({
      where,
      include: {
        invoice: { select: { id: true, invoiceNumber: true, sourceInvoiceRef: true } },
        shipment: { select: { id: true, shipmentRef: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { issueDate: 'desc' }
    });
  },

  async getReceiptById(id: string) {
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        payment: { include: { customer: true, financialAccount: true } },
        invoice: { select: { id: true, invoiceNumber: true, sourceInvoiceRef: true, totalAmount: true } },
        shipment: { select: { id: true, shipmentRef: true, containerNumber: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    if (!receipt) {
      const error: any = new Error('Receipt not found');
      error.status = 404;
      throw error;
    }

    return receipt;
  },

  async voidReceipt(id: string, voidReason: string, actorId: string, ipAddress?: string) {
    if (!voidReason || !voidReason.trim()) {
      const err: any = new Error('A business justification is required to void a receipt');
      err.status = 400;
      throw err;
    }

    const receipt = await prisma.receipt.findUnique({ where: { id } });
    if (!receipt) {
      const err: any = new Error('Receipt not found');
      err.status = 404;
      throw err;
    }

    if (receipt.status === 'VOIDED') {
      const err: any = new Error('Receipt is already voided');
      err.status = 400;
      throw err;
    }

    const updated = await prisma.receipt.update({
      where: { id },
      data: {
        status: 'VOIDED',
        voidReason,
        voidedAt: new Date(),
        voidedById: actorId
      }
    });

    await recordAuditEvent({
      actorId,
      action: 'RECEIPT_VOIDED',
      entityType: 'RECEIPT',
      entityId: id,
      oldValues: { status: 'ISSUED' },
      newValues: { status: 'VOIDED', voidReason },
      ipAddress
    });

    return updated;
  },

  async getReceiptPdfData(id: string) {
    const receipt = await this.getReceiptById(id);

    return {
      company: {
        legalName: 'Sky Ariana Ltd',
        brandName: 'Sky Ariana Ltd',
        platformName: 'AQ Companies',
        portalTitle: 'Logistics & Financial Management Portal',
        logoUrl: '/sky-ariana-logo.png',
        address: 'Kabul / Dubai Commercial Operations',
        email: 'info@skyariana.com',
        website: 'https://skyariana.com'
      },
      receipt: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        issueDate: receipt.issueDate.toISOString(),
        issueDateFormatted: receipt.issueDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        status: receipt.status,
        amount: Number(receipt.amount),
        amountFormatted: '$' + Number(receipt.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amountInWords: receipt.amountInWords,
        currency: receipt.currency,
        payerName: receipt.payerName,
        paymentMethod: receipt.paymentMethod.replace(/_/g, ' '),
        referenceNumber: receipt.referenceNumber || 'N/A',
        purpose: receipt.purpose,
        receivingAccountName: receipt.receivingAccountName,
        receivingAccountMasked: receipt.receivingAccountMasked,
        bankSwift: 'AUBKAFKA', // Afghan United Bank official SWIFT from workbook
        linkedInvoice: receipt.invoice ? (receipt.invoice.sourceInvoiceRef || receipt.invoice.invoiceNumber) : null,
        linkedShipment: receipt.shipment?.shipmentRef || null,
        notes: receipt.notes,
        recordedBy: receipt.createdBy ? `${receipt.createdBy.firstName} ${receipt.createdBy.lastName}` : 'Authorized Treasury Officer',
        voidReason: receipt.voidReason,
        voidedAt: receipt.voidedAt
      }
    };
  }
};
