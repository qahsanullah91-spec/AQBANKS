import { Router, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { prisma } from '../../prisma.js';
import { toDecimal, calculateInvoiceTotals } from '../../utils/decimal.js';
import { maskAccountNumber } from '../../utils/masking.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

const router = Router();

// Sanitize cell strings against CSV/Formula Injection and broken Excel artifacts (#VALUE!, #REF!, #N/A)
export function sanitizeCellString(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str === '#VALUE!' || str === '#REF!' || str === '#N/A' || str.includes('#VALUE!')) {
    return '';
  }
  if (['=', '+', '-', '@', '\t', '\r'].some(prefix => str.startsWith(prefix))) {
    // If it's a standard signed number (e.g. -50 or +10), keep numeric format
    if (str.startsWith('-') && /^-\d+(\.\d+)?$/.test(str)) {
      return str;
    }
    if (str.startsWith('+') && /^\+\d+(\.\d+)?$/.test(str)) {
      return str;
    }
    // Disarm formula injection by prepending single quote
    return `'${str}`;
  }
  return str;
}

interface SheetParseResult {
  sheetName: string;
  totalRows: number;
  validRows: number;
  warnings: string[];
  data: any[];
}

export function parseWorkbook(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Workbook file not found at ${filePath}`);
  }

  // Security Check: Validate file format (.xlsx only)
  if (!filePath.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Security Error: Invalid file format. Only verified .xlsx spreadsheet workbooks are permitted.');
  }

  // Calculate file hash
  const fileBuffer = fs.readFileSync(filePath);
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex').toUpperCase();

  const wb = XLSX.readFile(filePath, { raw: true, cellDates: false });

  // 1. Account & Routing Details
  const wsRouting = wb.Sheets['Account & Routing Details'];
  const bankDetails = {
    bankName: wsRouting['C7'] ? sanitizeCellString(wsRouting['C7'].v) : 'AFGHAN UNITED BANK',
    beneficiaryName: wsRouting['C8'] ? sanitizeCellString(wsRouting['C8'].v) : 'SKY ARIANA LTD',
    accountNumber: wsRouting['C9'] ? sanitizeCellString(wsRouting['C9'].v) : '101502USD2940472',
    swiftCode: wsRouting['C10'] ? sanitizeCellString(wsRouting['C10'].v) : 'AFGUAFKAXXX',
    correspondentBank: wsRouting['C15'] ? sanitizeCellString(wsRouting['C15'].v) : 'DA AFGHANISTAN BANK',
    correspondentSwift: wsRouting['C16'] ? sanitizeCellString(wsRouting['C16'].v) : 'AFGBAFKA'
  };

  // 2. Account Statement
  const wsLedger = wb.Sheets['Account Statement'];
  const ledgerRows: any[] = [];
  const ledgerWarnings: string[] = [];

  // Rows 7 to 12
  for (let r = 7; r <= 12; r++) {
    const dateCell = wsLedger[`A${r}`];
    const refCell = wsLedger[`B${r}`];
    const descCell = wsLedger[`C${r}`];
    const catCell = wsLedger[`D${r}`];
    const debitCell = wsLedger[`E${r}`];
    const creditCell = wsLedger[`F${r}`];

    if (descCell && descCell.v) {
      const debitVal = debitCell ? toDecimal(debitCell.v).toNumber() : 0;
      const creditVal = creditCell ? toDecimal(creditCell.v).toNumber() : 0;

      if (r === 7 && creditVal === 83.36) {
        ledgerWarnings.push(
          `Row 7 ($83.36, "Starting Balance Prior to Transfers") flagged: Requires owner confirmation if this is Opening Balance or commercial transaction.`
        );
      }

      ledgerRows.push({
        sourceRow: r,
        date: dateCell ? sanitizeCellString(dateCell.v) : '01-Sep-2026',
        reference: refCell && refCell.v !== 'N/A' ? sanitizeCellString(refCell.v) : null,
        description: sanitizeCellString(descCell.v),
        category: catCell ? sanitizeCellString(catCell.v) : 'Credit',
        debit: debitVal,
        credit: creditVal
      });
    }
  }

  // 3. Proforma Invoices
  const wsInvoices = wb.Sheets['Proforma Invoices'];
  const invoiceRows: any[] = [];
  const invoiceWarnings: string[] = [];
  const proformaRefCounts: Record<string, number> = {};

  for (let r = 7; r <= 14; r++) {
    const dateCell = wsInvoices[`B${r}`];
    const refCell = wsInvoices[`C${r}`];
    const buyerCell = wsInvoices[`D${r}`];
    const descCell = wsInvoices[`E${r}`];
    const wtCell = wsInvoices[`F${r}`];
    const amtCell = wsInvoices[`G${r}`];
    const statusCell = wsInvoices[`H${r}`];

    if (buyerCell && buyerCell.v) {
      const pRef = refCell ? String(refCell.v).trim() : `PI-ROW-${r}`;
      proformaRefCounts[pRef] = (proformaRefCounts[pRef] || 0) + 1;

      const weight = wtCell ? toDecimal(wtCell.v).toNumber() : 0;
      const totalAmt = amtCell ? toDecimal(amtCell.v).toNumber() : 0;
      const unitPrice = weight > 0 ? totalAmt / weight : 0;

      invoiceRows.push({
        sourceRow: r,
        date: dateCell ? sanitizeCellString(dateCell.v) : '',
        proformaNo: pRef,
        buyer: sanitizeCellString(buyerCell.v),
        itemDescription: descCell ? sanitizeCellString(descCell.v) : '',
        netWeightKg: weight,
        expectedAmountUsd: totalAmt,
        calculatedUnitPrice: unitPrice,
        paymentStatus: statusCell ? sanitizeCellString(statusCell.v) : 'Pending'
      });
    }
  }

  // Flag duplicate proforma refs
  Object.entries(proformaRefCounts).forEach(([ref, count]) => {
    if (count > 1) {
      invoiceWarnings.push(
        `Human proforma number "${ref}" appears ${count} times in source. Must be isolated with unique internal UUIDs.`
      );
    }
  });

  // 4. Logistics & Tracking
  const wsLogistics = wb.Sheets['Logistics & Tracking'];
  const shipmentRows: any[] = [];
  const shipmentWarnings: string[] = [];

  for (let r = 6; r <= 7; r++) {
    const dateCell = wsLogistics[`B${r}`];
    const shpRefCell = wsLogistics[`C${r}`];
    const pRefCell = wsLogistics[`D${r}`];
    const cntCell = wsLogistics[`E${r}`];
    const blCell = wsLogistics[`F${r}`];
    const routeCell = wsLogistics[`G${r}`];
    const carrierCell = wsLogistics[`H${r}`];
    const etaCell = wsLogistics[`I${r}`];
    const statusCell = wsLogistics[`J${r}`];

    if (shpRefCell && shpRefCell.v) {
      const pRef = pRefCell ? sanitizeCellString(pRefCell.v) : null;
      if (pRef && proformaRefCounts[pRef] > 1) {
        shipmentWarnings.push(
          `Shipment Row ${r} (${shpRefCell.v}) references proforma "${pRef}", which is ambiguous (${proformaRefCounts[pRef]} candidates found). Junction association requires user confirmation.`
        );
      }

      const routeStr = routeCell ? sanitizeCellString(routeCell.v) : '';
      const [origin, destination] = routeStr.includes('->')
        ? routeStr.split('->').map(s => s.trim())
        : [routeStr, ''];

      shipmentRows.push({
        sourceRow: r,
        date: dateCell ? sanitizeCellString(dateCell.v) : '',
        shipmentRef: sanitizeCellString(shpRefCell.v),
        proformaRef: pRef,
        containerNumber: cntCell ? sanitizeCellString(cntCell.v) : null,
        billOfLading: blCell ? sanitizeCellString(blCell.v) : null,
        origin,
        destination,
        carrier: carrierCell ? sanitizeCellString(carrierCell.v) : null,
        eta: etaCell ? sanitizeCellString(etaCell.v) : null,
        status: statusCell ? sanitizeCellString(statusCell.v) : 'In Transit'
      });
    }
  }

  // Calculate comparison checkpoint totals
  const totalCredits = ledgerRows.reduce((sum, r) => sum.plus(toDecimal(r.credit)), toDecimal(0));
  const totalDebits = ledgerRows.reduce((sum, r) => sum.plus(toDecimal(r.debit)), toDecimal(0));
  const availableBalance = totalCredits.minus(totalDebits);

  const totalInvoiced = invoiceRows.reduce((sum, r) => sum.plus(toDecimal(r.expectedAmountUsd)), toDecimal(0));
  const totalPending = invoiceRows
    .filter(r => r.paymentStatus === 'Pending')
    .reduce((sum, r) => sum.plus(toDecimal(r.expectedAmountUsd)), toDecimal(0));

  return {
    fileHash,
    bankDetails,
    ledger: { rows: ledgerRows, warnings: ledgerWarnings },
    invoices: { rows: invoiceRows, warnings: invoiceWarnings },
    shipments: { rows: shipmentRows, warnings: shipmentWarnings },
    checkpointTotals: {
      totalCredits: totalCredits.toFixed(2),
      totalDebits: totalDebits.toFixed(2),
      availableBalance: availableBalance.toFixed(2),
      totalInvoiced: totalInvoiced.toFixed(2),
      totalPending: totalPending.toFixed(2)
    }
  };
}

// Helper to parse dates like "05-Sep-2026"
function parseWorkbookDate(str: string): Date {
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
}

// POST /api/import/dry-run
router.post('/dry-run', authenticate, requirePermission('import:execute'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workbookPath = path.resolve(process.cwd(), '../AQ_Companies_System_v10_Logistics.xlsx');
    const parsed = parseWorkbook(workbookPath);

    const allWarnings = [
      ...parsed.ledger.warnings,
      ...parsed.invoices.warnings,
      ...parsed.shipments.warnings
    ];

    // Compute diff against current live database
    const existingInvoices = await prisma.invoice.findMany({ include: { customer: true } });
    const existingTxs = await prisma.ledgerTransaction.findMany();

    const matchedInvoices: any[] = [];
    const newInvoices: any[] = [];
    for (const r of parsed.invoices.rows) {
      const match = existingInvoices.find(
        inv => (inv.customer?.companyName.toLowerCase() === r.buyer.toLowerCase() || inv.sourceInvoiceRef === r.proformaNo) &&
               Math.abs(Number(inv.totalAmount) - Number(r.expectedAmountUsd)) < 0.01
      );
      if (match) {
        matchedInvoices.push({
          sourceRow: r.sourceRow,
          proformaNo: r.proformaNo,
          buyer: r.buyer,
          matchedSystemInvoice: match.invoiceNumber,
          amount: r.expectedAmountUsd,
          action: 'MATCHED_EXISTING_UPSERT'
        });
      } else {
        newInvoices.push({
          sourceRow: r.sourceRow,
          proformaNo: r.proformaNo,
          buyer: r.buyer,
          amount: r.expectedAmountUsd,
          action: 'NEW_RECORD_INSERT'
        });
      }
    }

    const matchedLedger: any[] = [];
    const newLedger: any[] = [];
    for (const r of parsed.ledger.rows) {
      const match = existingTxs.find(
        tx => tx.description.toLowerCase().trim() === r.description.toLowerCase().trim() &&
              Math.abs(Number(tx.creditAmount) - Number(r.credit)) < 0.01 &&
              Math.abs(Number(tx.debitAmount) - Number(r.debit)) < 0.01
      );
      if (match) {
        matchedLedger.push({
          sourceRow: r.sourceRow,
          description: r.description,
          credit: r.credit,
          debit: r.debit,
          action: 'MATCHED_EXISTING'
        });
      } else {
        newLedger.push({
          sourceRow: r.sourceRow,
          description: r.description,
          credit: r.credit,
          debit: r.debit,
          action: 'NEW_ENTRY'
        });
      }
    }

    res.json({
      status: 'DRY_RUN_COMPLETED',
      fileHash: parsed.fileHash,
      isAuthenticHash: parsed.fileHash === 'BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA',
      counts: {
        bankAccounts: 1,
        ledgerTransactions: parsed.ledger.rows.length,
        proformaInvoices: parsed.invoices.rows.length,
        shipments: parsed.shipments.rows.length
      },
      checkpointTotals: parsed.checkpointTotals,
      warningsCount: allWarnings.length,
      warnings: allWarnings,
      diffPreview: {
        matchedInvoicesCount: matchedInvoices.length,
        newInvoicesCount: newInvoices.length,
        matchedInvoices,
        newInvoices,
        matchedLedgerCount: matchedLedger.length,
        newLedgerCount: newLedger.length,
        matchedLedger,
        newLedger,
        validationWarnings: allWarnings
      },
      preview: {
        bankDetails: parsed.bankDetails,
        ledgerRows: parsed.ledger.rows,
        invoiceRows: parsed.invoices.rows,
        shipmentRows: parsed.shipments.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/commit (Administrator only)
router.post('/commit', authenticate, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workbookPath = path.resolve(process.cwd(), '../AQ_Companies_System_v10_Logistics.xlsx');
    const parsed = parseWorkbook(workbookPath);

    // Prevent duplicate import of the exact same file hash if already committed
    const existingCommit = await prisma.import.findFirst({
      where: { fileHash: parsed.fileHash, status: 'COMMITTED' }
    });

    if (existingCommit) {
      res.status(409).json({
        error: 'ALREADY_IMPORTED',
        message: 'This workbook has already been committed to the database. Idempotency prevents duplicate imports.'
      });
      return;
    }

    const importRecord = await prisma.$transaction(async (tx) => {
      // 1. Create Import Audit header
      const imp = await tx.import.create({
        data: {
          filename: 'AQ_Companies_System_v10_Logistics.xlsx',
          fileHash: parsed.fileHash,
          status: 'COMMITTED',
          totalRows: parsed.ledger.rows.length + parsed.invoices.rows.length + parsed.shipments.rows.length,
          acceptedRows: parsed.ledger.rows.length + parsed.invoices.rows.length + parsed.shipments.rows.length,
          rejectedRows: 0,
          summaryJson: JSON.stringify(parsed.checkpointTotals),
          executedBy: req.user!.email
        }
      });

      // 2. Company Profile & Bank Account
      let companyProfile = await tx.companyProfile.findFirst();
      if (!companyProfile) {
        companyProfile = await tx.companyProfile.create({
          data: {
            orgName: 'AQ Companies',
            legalName: parsed.bankDetails.beneficiaryName,
            email: 'info@skyariana.com',
            website: 'www.skyariana.com'
          }
        });
      }

      let bankAccount = await tx.bankAccount.findFirst({
        where: { bankName: parsed.bankDetails.bankName }
      });
      if (!bankAccount) {
        bankAccount = await tx.bankAccount.create({
          data: {
            companyProfileId: companyProfile.id,
            bankName: parsed.bankDetails.bankName,
            beneficiaryName: parsed.bankDetails.beneficiaryName,
            accountNumberEncrypted: parsed.bankDetails.accountNumber,
            accountNumberMasked: maskAccountNumber(parsed.bankDetails.accountNumber),
            swiftCode: parsed.bankDetails.swiftCode,
            correspondentBank: parsed.bankDetails.correspondentBank,
            correspondentSwift: parsed.bankDetails.correspondentSwift,
            isPrimary: true
          }
        });
      }

      // 3. Primary Financial Account
      let financialAccount = await tx.financialAccount.findFirst({ where: { currency: 'USD' } });
      if (!financialAccount) {
        financialAccount = await tx.financialAccount.create({
          data: {
            name: 'Afghan United Bank - USD Operating',
            accountNumber: parsed.bankDetails.accountNumber,
            currency: 'USD',
            openingBalance: 0,
            currentBalance: 0
          }
        });
      }

      // 4. Import Ledger Transactions
      for (const row of parsed.ledger.rows) {
        const cat = row.category.toUpperCase().includes('DEBIT') ? 'DEBIT' :
                    row.category.toUpperCase().includes('BALANCE') ? 'BALANCE' : 'CREDIT';

        const createdTx = await tx.ledgerTransaction.create({
          data: {
            financialAccountId: financialAccount.id,
            effectiveDate: parseWorkbookDate(row.date),
            reference: row.reference,
            description: row.description,
            category: cat,
            debitAmount: row.debit,
            creditAmount: row.credit,
            currency: 'USD',
            reconciliationStatus: 'UNRECONCILED'
          }
        });

        await tx.importRow.create({
          data: {
            importId: imp.id,
            sourceSheet: 'Account Statement',
            sourceRow: row.sourceRow,
            entityType: 'LEDGER_TRANSACTION',
            entityId: createdTx.id,
            rawDataJson: JSON.stringify(row),
            status: 'SUCCESS',
            message: `Imported ledger transaction: ${row.description}`
          }
        });
      }

      // 5. Import Customers & Invoices
      const invoiceMapByRow = new Map<number, any>();

      for (const row of parsed.invoices.rows) {
        // Find or create customer
        let customer = await tx.customer.findFirst({
          where: { companyName: row.buyer }
        });
        if (!customer) {
          customer = await tx.customer.create({
            data: { companyName: row.buyer }
          });
        }

        // Match existing invoice by buyer + sourceRef + expectedAmount
        let existingInv = await tx.invoice.findFirst({
          where: {
            customerId: customer.id,
            sourceInvoiceRef: row.proformaNo,
            totalAmount: row.expectedAmountUsd
          }
        });

        const ctnMatch = row.itemDescription.match(/(\d[\d,]*)\s*CTNS/i);
        const cartonCount = ctnMatch ? parseInt(ctnMatch[1].replace(/,/g, ''), 10) : null;
        const packagingKg = cartonCount && row.netWeightKg ? row.netWeightKg / cartonCount : null;

        const issueDate = parseWorkbookDate(row.date);
        const pStatus = row.paymentStatus.includes('PAID') ? 'PAID' : 'UNPAID';

        let inv;
        if (existingInv) {
          inv = await tx.invoice.update({
            where: { id: existingInv.id },
            data: {
              subtotal: row.expectedAmountUsd,
              totalAmount: row.expectedAmountUsd,
              paymentStatus: pStatus
            }
          });
        } else {
          // Generate sequential numbering PI-2026-0001 through 0008 for official rows 7..14
          const seqNum = row.sourceRow >= 7 && row.sourceRow <= 14 ? row.sourceRow - 6 : row.sourceRow;
          const distinctSystemNo = `PI-2026-${seqNum.toString().padStart(4, '0')}`;

          inv = await tx.invoice.create({
            data: {
              customerId: customer.id,
              invoiceNumber: distinctSystemNo,
              sourceInvoiceRef: row.proformaNo,
              issueDate,
              paymentTerms: '100% Advance Payment',
              bankAccountId: bankAccount.id,
              subtotal: row.expectedAmountUsd,
              taxAmount: 0,
              totalAmount: row.expectedAmountUsd,
              status: 'ISSUED',
              paymentStatus: pStatus,
              lines: {
                create: [
                  {
                    lineNumber: 1,
                    description: row.itemDescription,
                    cartonCount,
                    packagingKgPerCarton: packagingKg,
                    quantity: row.netWeightKg,
                    unitOfMeasure: 'KG',
                    unitPrice: row.calculatedUnitPrice,
                    lineTotal: row.expectedAmountUsd
                  }
                ]
              }
            }
          });
        }

        invoiceMapByRow.set(row.sourceRow, inv);

        await tx.importRow.create({
          data: {
            importId: imp.id,
            sourceSheet: 'Proforma Invoices',
            sourceRow: row.sourceRow,
            entityType: 'INVOICE',
            entityId: inv.id,
            rawDataJson: JSON.stringify(row),
            status: 'SUCCESS',
            message: `Imported/Upserted proforma invoice ${inv.invoiceNumber} (Source Ref: ${row.proformaNo})`
          }
        });
      }

      // 6. Import Shipments
      for (const row of parsed.shipments.rows) {
        const shp = await tx.shipment.create({
          data: {
            shipmentRef: row.shipmentRef,
            containerNumber: row.containerNumber,
            billOfLading: row.billOfLading,
            origin: row.origin,
            destination: row.destination,
            carrier: row.carrier,
            shipmentDate: parseWorkbookDate(row.date),
            estimatedArrivalDate: row.eta ? parseWorkbookDate(row.eta) : null,
            status: row.status === 'At Origin Port' ? 'AT_ORIGIN_PORT' : 'IN_TRANSIT',
            statusHistory: {
              create: {
                newStatus: row.status === 'At Origin Port' ? 'AT_ORIGIN_PORT' : 'IN_TRANSIT',
                changedBy: req.user!.email,
                reason: 'Migrated from workbook'
              }
            }
          }
        });

        await tx.importRow.create({
          data: {
            importId: imp.id,
            sourceSheet: 'Logistics & Tracking',
            sourceRow: row.sourceRow,
            entityType: 'SHIPMENT',
            entityId: shp.id,
            rawDataJson: JSON.stringify(row),
            status: 'SUCCESS',
            message: `Imported shipment ${row.shipmentRef}`
          }
        });
      }

      return imp;
    });

    await recordAuditEvent({
      actorId: req.user!.userId,
      action: 'WORKBOOK_IMPORTED',
      entityType: 'IMPORT',
      entityId: importRecord.id,
      newValues: { totals: parsed.checkpointTotals },
      ipAddress: req.ip
    });

    res.status(201).json({
      status: 'COMMITTED',
      importId: importRecord.id,
      checkpointTotals: parsed.checkpointTotals,
      message: 'Workbook committed transactionally. Reconciliation review required before production sign-off.'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/import/history
router.get('/history', authenticate, requirePermission('import:execute'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const imports = await prisma.import.findMany({
      include: {
        _count: {
          select: { rows: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(imports);
  } catch (err) {
    next(err);
  }
});

export default router;
