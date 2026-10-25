import { prisma } from '../../prisma.js';
import { generateNextReceiptNumber, numberToWords } from './receipts.util.js';
import { calculateLedgerRunningBalances } from '../../utils/decimal.js';
import { recordAuditEvent } from '../../middleware/audit.js';

export interface UpdateReceiptInput {
  payerName?: string;
  purpose?: string;
  referenceNumber?: string | null;
  notes?: string | null;
  issueDate?: string;
  grossAmount?: number;
  swiftFeeAmount?: number;
}

export interface CreateReceiptInput {
  paymentId?: string;
  ledgerTransactionId?: string;
  payerName: string;
  receivingAccountName?: string;
  receivingAccountMasked?: string;
  amount: number | string;
  grossAmount?: number | string | null;
  swiftFeeAmount?: number | string;
  currency?: string;
  paymentMethod?: string;
  referenceNumber?: string | null;
  purpose: string;
  issueDate?: Date | string;
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
    const numSwiftFee = input.swiftFeeAmount !== undefined && input.swiftFeeAmount !== null
      ? (typeof input.swiftFeeAmount === 'string' ? parseFloat(input.swiftFeeAmount) : input.swiftFeeAmount)
      : 0;
    let numGross = input.grossAmount !== undefined && input.grossAmount !== null
      ? (typeof input.grossAmount === 'string' ? parseFloat(input.grossAmount) : input.grossAmount)
      : null;
    let numNet = typeof input.amount === 'string' ? parseFloat(input.amount) : input.amount;

    if (numSwiftFee > 0) {
      if (numGross === null || numGross === undefined) {
        // If gross was not explicitly provided, input.amount was the gross commercial amount
        numGross = numNet;
        numNet = Number((numGross - numSwiftFee).toFixed(2));
      } else if (Math.abs(numGross - numNet) < 0.001) {
        // Both were passed as gross amount, calculate net
        numNet = Number((numGross - numSwiftFee).toFixed(2));
      } else if (numGross < numNet) {
        numGross = Number((numNet + numSwiftFee).toFixed(2));
      }
    }

    const words = numberToWords(numNet, currency);
    const receiptNumber = await generateNextReceiptNumber(db);

    // Default masked bank details if not provided
    const accountName = input.receivingAccountName || 'Afghan United Bank Operating Account';
    const accountMasked = input.receivingAccountMasked || '101502******0472';

    let creatorId = input.createdById || null;
    if (!creatorId) {
      const defaultUser = await db.user.findFirst({
        where: {
          OR: [
            { email: 'ahsanullah@aqcompanies.com' },
            { role: 'ADMIN' }
          ]
        }
      });
      if (defaultUser) creatorId = defaultUser.id;
    }

    const receipt = await db.receipt.create({
      data: {
        receiptNumber,
        paymentId: input.paymentId || null,
        ledgerTransactionId: input.ledgerTransactionId || null,
        issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),
        payerName: input.payerName,
        receivingAccountName: accountName,
        receivingAccountMasked: accountMasked,
        amount: numNet,
        grossAmount: numGross,
        swiftFeeAmount: numSwiftFee,
        amountInWords: words,
        currency,
        paymentMethod: input.paymentMethod || 'WIRE_TRANSFER',
        referenceNumber: input.referenceNumber || null,
        purpose: input.purpose,
        invoiceId: input.invoiceId || null,
        shipmentId: input.shipmentId || null,
        notes: input.notes || null,
        status: 'ISSUED',
        createdById: creatorId
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

  /**
   * Update a receipt's descriptive and financial fields. Financial changes are
   * propagated to the linked ledger transaction (bank credit) and payment
   * allocation so books stay consistent, then running balances are recalculated.
   */
  async updateReceipt(id: string, input: UpdateReceiptInput, actorId: string, ipAddress?: string) {
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: { payment: { include: { allocations: true } } }
    });
    if (!receipt) {
      const err: any = new Error('Receipt not found');
      err.status = 404;
      throw err;
    }
    if (receipt.status === 'VOIDED') {
      const err: any = new Error('Cannot edit a voided receipt');
      err.status = 400;
      throw err;
    }

    const currentGross = receipt.grossAmount !== null && receipt.grossAmount !== undefined
      ? Number(receipt.grossAmount)
      : Number(receipt.amount) + Number(receipt.swiftFeeAmount || 0);
    const currentFee = Number(receipt.swiftFeeAmount || 0);
    const newGross = input.grossAmount !== undefined ? input.grossAmount : currentGross;
    const newFee = input.swiftFeeAmount !== undefined ? input.swiftFeeAmount : currentFee;

    if (newGross <= 0) {
      const err: any = new Error('Gross amount must be greater than zero');
      err.status = 400;
      throw err;
    }
    if (newFee < 0 || newFee >= newGross) {
      const err: any = new Error('SWIFT fee must be zero or more, and less than the gross amount');
      err.status = 400;
      throw err;
    }

    const newNet = Number((newGross - newFee).toFixed(2));
    const amountsChanged = newGross !== currentGross || newFee !== currentFee;
    const invoiceId = receipt.payment?.allocations?.[0]?.invoiceId || receipt.invoiceId;

    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.receipt.update({
        where: { id },
        data: {
          payerName: input.payerName !== undefined ? input.payerName.trim() : receipt.payerName,
          purpose: input.purpose !== undefined ? input.purpose.trim() : receipt.purpose,
          referenceNumber: input.referenceNumber !== undefined ? (input.referenceNumber || null) : receipt.referenceNumber,
          notes: input.notes !== undefined ? (input.notes || null) : receipt.notes,
          issueDate: input.issueDate ? new Date(input.issueDate) : receipt.issueDate,
          ...(amountsChanged ? {
            grossAmount: newGross,
            swiftFeeAmount: newFee,
            amount: newNet,
            amountInWords: numberToWords(newNet, receipt.currency)
          } : {})
        }
      });

      if (amountsChanged && receipt.ledgerTransactionId) {
        const ledgerTx = await tx.ledgerTransaction.findUnique({ where: { id: receipt.ledgerTransactionId } });
        if (ledgerTx) {
          await tx.ledgerTransaction.update({
            where: { id: ledgerTx.id },
            data: { creditAmount: newNet }
          });
          const finAccount = await tx.financialAccount.findUnique({ where: { id: ledgerTx.financialAccountId } });
          const allTxs = await tx.ledgerTransaction.findMany({
            orderBy: [{ effectiveDate: 'asc' }, { postedAt: 'asc' }, { id: 'asc' }]
          });
          const calculated = calculateLedgerRunningBalances(finAccount ? Number(finAccount.openingBalance) : 0, allTxs);
          for (const c of calculated) {
            await tx.ledgerTransaction.update({
              where: { id: c.id },
              data: { runningBalance: c.runningBalance.toNumber() }
            });
          }
        }
      }

      if (amountsChanged && receipt.payment) {
        const allocations = receipt.payment.allocations || [];
        const totalOldGross = allocations.reduce(
          (s, a) => s + Number(a.amount) + Number(a.swiftBankFee || 0), 0
        );
        for (const a of allocations) {
          const share = totalOldGross > 0
            ? (Number(a.amount) + Number(a.swiftBankFee || 0)) / totalOldGross
            : (1 / Math.max(allocations.length, 1));
          await tx.paymentAllocation.update({
            where: { id: a.id },
            data: {
              amount: Number((newGross * share).toFixed(2)),
              swiftBankFee: Number((newFee * share).toFixed(2))
            }
          });
        }
        await tx.payment.update({
          where: { id: receipt.payment.id },
          data: { totalAmount: newGross, allocatedAmount: newGross, unallocatedAmount: 0 }
        });
      }

      if (invoiceId) {
        await this.recomputeInvoicePaymentStatus(tx, invoiceId);
      }

      return rec;
    });

    await recordAuditEvent({
      actorId,
      action: 'RECEIPT_UPDATED',
      entityType: 'RECEIPT',
      entityId: id,
      oldValues: {
        payerName: receipt.payerName,
        purpose: receipt.purpose,
        grossAmount: currentGross,
        swiftFeeAmount: currentFee,
        netAmount: Number(receipt.amount)
      },
      newValues: {
        payerName: updated.payerName,
        purpose: updated.purpose,
        grossAmount: newGross,
        swiftFeeAmount: newFee,
        netAmount: newNet
      },
      ipAddress
    });

    return updated;
  },

  /**
   * Permanently delete a receipt and unwind its linked payment (with
   * allocations) and bank ledger credit, then recalculate running balances and
   * the invoice payment status. This restores the books to the pre-payment state.
   */
  async deleteReceipt(id: string, actorId: string, ipAddress?: string) {
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: { payment: { include: { allocations: true } } }
    });
    if (!receipt) {
      const err: any = new Error('Receipt not found');
      err.status = 404;
      throw err;
    }

    const invoiceId = receipt.payment?.allocations?.[0]?.invoiceId || receipt.invoiceId;
    const ledgerTx = receipt.ledgerTransactionId
      ? await prisma.ledgerTransaction.findUnique({ where: { id: receipt.ledgerTransactionId }, select: { financialAccountId: true } })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.receipt.delete({ where: { id } });

      if (receipt.paymentId) {
        // Cascades to payment_allocations, removing paid amounts from invoices
        await tx.payment.delete({ where: { id: receipt.paymentId } });
      }

      if (receipt.ledgerTransactionId && ledgerTx) {
        await tx.ledgerTransaction.delete({ where: { id: receipt.ledgerTransactionId } });
        const finAccount = await tx.financialAccount.findUnique({ where: { id: ledgerTx.financialAccountId } });
        const allTxs = await tx.ledgerTransaction.findMany({
          orderBy: [{ effectiveDate: 'asc' }, { postedAt: 'asc' }, { id: 'asc' }]
        });
        const calculated = calculateLedgerRunningBalances(finAccount ? Number(finAccount.openingBalance) : 0, allTxs);
        for (const c of calculated) {
          await tx.ledgerTransaction.update({
            where: { id: c.id },
            data: { runningBalance: c.runningBalance.toNumber() }
          });
        }
      }

      if (invoiceId) {
        await this.recomputeInvoicePaymentStatus(tx, invoiceId);
      }
    });

    await recordAuditEvent({
      actorId,
      action: 'RECEIPT_DELETED',
      entityType: 'RECEIPT',
      entityId: id,
      oldValues: {
        receiptNumber: receipt.receiptNumber,
        payerName: receipt.payerName,
        grossAmount: receipt.grossAmount ? Number(receipt.grossAmount) : null,
        swiftFeeAmount: Number(receipt.swiftFeeAmount || 0),
        netAmount: Number(receipt.amount),
        linkedPaymentId: receipt.paymentId,
        linkedLedgerTransactionId: receipt.ledgerTransactionId
      },
      ipAddress
    });

    return { success: true, deletedReceiptNumber: receipt.receiptNumber };
  },

  // Recompute an invoice's paymentStatus from its surviving payment allocations
  async recomputeInvoicePaymentStatus(tx: any, invoiceId: string) {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { paymentAllocations: true }
    });
    if (!inv) return;
    const allocated = inv.paymentAllocations.reduce(
      (s: number, a: any) => s + Number(a.amount) + Number(a.swiftBankFee || 0), 0
    );
    const total = Number(inv.totalAmount);
    const paymentStatus = allocated <= 0.005 ? 'UNPAID' : (allocated + 0.005 >= total ? 'PAID' : 'PARTIALLY_PAID');
    await tx.invoice.update({ where: { id: inv.id }, data: { paymentStatus } });
  },

  async getReceiptPdfData(id: string) {    const receipt = await this.getReceiptById(id);

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
        grossAmount: receipt.grossAmount ? Number(receipt.grossAmount) : null,
        grossAmountFormatted: receipt.grossAmount ? '$' + Number(receipt.grossAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null,
        swiftFeeAmount: Number(receipt.swiftFeeAmount || 0),
        swiftFeeAmountFormatted: Number(receipt.swiftFeeAmount || 0) > 0 ? '$' + Number(receipt.swiftFeeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null,
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
