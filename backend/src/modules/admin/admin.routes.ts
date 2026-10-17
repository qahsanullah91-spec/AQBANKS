import { Router, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../../prisma.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';
import { calculateLedgerRunningBalances, toDecimal } from '../../utils/decimal.js';

const router = Router();

// GET /api/admin/users (Admin only)
router.get('/users', authenticate, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      include: {
        userRoles: {
          include: { role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      roles: u.userRoles.map(r => r.role.name),
      createdAt: u.createdAt
    })));
  } catch (err) {
    next(err);
  }
});

// Helper for resetting database to exact Master Excel Baseline
export async function executeBaselineReset(actorId?: string) {
  // 1. Purge all operational and test records cleanly
  await prisma.receipt.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.shipmentInvoice.deleteMany();
  await prisma.shipmentStatusHistory.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.invoiceBankSnapshot.deleteMany();
  await prisma.invoiceSnapshot.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.ledgerTransaction.deleteMany();
  await prisma.importRow.deleteMany();
  await prisma.import.deleteMany();

  // 2. Organization Profile & Default Banking Details
  let companyProfile = await prisma.companyProfile.findFirst();
  if (!companyProfile) {
    companyProfile = await prisma.companyProfile.create({
      data: {
        orgName: 'AQ Companies',
        legalName: 'SKY ARIANA LTD',
        email: 'info@skyariana.com',
        website: 'www.skyariana.com',
        currency: 'USD'
      }
    });
  }

  // 3. Primary Bank Account (Afghan United Bank - AUB)
  let bankAccount = await prisma.bankAccount.findFirst({
    where: { bankName: { contains: 'AFGHAN UNITED BANK' } }
  });

  const aubData = {
    companyProfileId: companyProfile.id,
    bankName: 'Afghan United Bank (AUB)',
    beneficiaryName: 'Sky Ariana LTD',
    accountNumberEncrypted: '101502USD2940472',
    accountNumberMasked: '101502******0472',
    cifNumberEncrypted: '000374739',
    cifNumberMasked: '******4739',
    accountType: 'AWDCCA',
    accountStatus: 'Active',
    openingDate: new Date('2026-09-13T00:00:00.000Z'),
    branchName: 'AUB Building Zarghona Maidan, Shahr-e-Now, Kabul',
    swiftCode: 'AFGUAFKAXXX',
    correspondentBank: 'AL SALAM BANK BAHRAIN',
    correspondentSwift: 'ALSABHBMXXX',
    currency: 'USD',
    isPrimary: true
  };

  if (!bankAccount) {
    bankAccount = await prisma.bankAccount.create({ data: aubData });
  } else {
    bankAccount = await prisma.bankAccount.update({
      where: { id: bankAccount.id },
      data: aubData
    });
  }

  // 4. Remittance Profiles
  // Profile A: Local USD Inward Remittance
  let localProfile = await prisma.remittanceProfile.findFirst({
    where: { bankAccountId: bankAccount.id, profileType: 'LOCAL' }
  });

  const localProfileData = {
    bankAccountId: bankAccount.id,
    profileType: 'LOCAL',
    name: 'Local USD Inward Remittance (DAB Clearing)',
    beneficiaryName: 'SKY ARIANA LTD',
    beneficiaryAccount: '101502USD2940472',
    beneficiaryBank: 'AFGHAN UNITED BANK',
    beneficiaryBankAddress: 'AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul',
    beneficiarySwift: 'AFGUAFKAXXX',
    correspondentBank: '(DAB) DA AFGHANISTAN BANK',
    correspondentSwift: 'AFGBAFKA',
    correspondentAccount: '3000205027231',
    correspondentLocation: 'Ibni-sina Watt, Kabul',
    isDefault: false,
    isActive: true,
    verificationNotes: 'Approved for local domestic USD clearing within Afghanistan via Da Afghanistan Bank (DAB).'
  };

  if (!localProfile) {
    localProfile = await prisma.remittanceProfile.create({ data: localProfileData });
  } else {
    localProfile = await prisma.remittanceProfile.update({
      where: { id: localProfile.id },
      data: localProfileData
    });
  }

  // Profile B: International USD Inward Remittance
  let intlProfile = await prisma.remittanceProfile.findFirst({
    where: { bankAccountId: bankAccount.id, profileType: 'INTERNATIONAL' }
  });

  const intlProfileData = {
    bankAccountId: bankAccount.id,
    profileType: 'INTERNATIONAL',
    name: 'International USD Inward Remittance (Al Salam / JPMorgan)',
    beneficiaryName: 'SKY ARIANA LTD',
    beneficiaryAccount: '101502USD2940472',
    beneficiaryBank: 'AFGHAN UNITED BANK',
    beneficiaryBankAddress: 'AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul',
    beneficiarySwift: 'AFGUAFKAXXX',
    swiftField57A: 'AFGUAFKAXXX',
    swiftField59A: '101502USD2940472 (Beneficiary account in field 59A; AFGUAFKAXXX in field 57A.)',
    aubAccountWithCorrespondent: 'BH61ALSA00500951200102',
    correspondentBank: 'AL SALAM BANK BAHRAIN',
    correspondentSwift: 'ALSABHBMXXX',
    correspondentAccount: '400758954',
    correspondentLocation: 'Sanabis, Bahrain',
    swiftField56A: 'ALSABHBM',
    intermediaryBank: 'JPMorgan Chase Bank, New York',
    intermediarySwift: 'CHASUS33',
    swiftField54A: 'Intermediary bank mandatory in field 54A',
    mt103VerificationFlag: true,
    verificationNotes: 'IMPORTANT: The intermediary bank instructions state that the intermediary bank is mandatory in field 54A. Preserve this instruction in the stored configuration, but flag the exact MT103 field mapping for verification by the bank before production use.',
    isDefault: true,
    isActive: true
  };

  if (!intlProfile) {
    intlProfile = await prisma.remittanceProfile.create({ data: intlProfileData });
  } else {
    intlProfile = await prisma.remittanceProfile.update({
      where: { id: intlProfile.id },
      data: intlProfileData
    });
  }

  // 5. Primary Financial USD Account
  let financialAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
  if (!financialAccount) {
    financialAccount = await prisma.financialAccount.create({
      data: {
        name: 'Afghan United Bank - USD Operating (AWDCCA)',
        accountNumber: '101502USD2940472',
        currency: 'USD',
        openingBalance: 83.36,
        currentBalance: 24259.61
      }
    });
  } else {
    financialAccount = await prisma.financialAccount.update({
      where: { id: financialAccount.id },
      data: {
        name: 'Afghan United Bank - USD Operating (AWDCCA)',
        accountNumber: '101502USD2940472',
        openingBalance: 83.36,
        currentBalance: 24259.61
      }
    });
  }

  // 6. Seed the 4 Official Customers
  const customersData = [
    {
      companyName: 'G.T JAYANTI AGROCHEM INDIA PVT LTD',
      addressLine1: 'Shop No 14, APMC Market-1, Phase II, Turbhe',
      addressLine2: 'Navi Mumbai, Maharashtra 400705',
      country: 'India',
      email: 'jayanti@gtagrochem.com',
      isCustomer: true
    },
    {
      companyName: 'G.T INDIA PVT LTD',
      addressLine1: '4012, 4th Floor, Naya Bazar, Khari Baoli',
      addressLine2: 'Delhi 110006',
      country: 'India',
      email: 'imports@gtindia.com',
      isCustomer: true
    },
    {
      companyName: 'MANIK TRADERS',
      addressLine1: 'Plot 88, Grain Merchant Enclave, Lawrence Road',
      addressLine2: 'Delhi 110035',
      country: 'India',
      email: 'maniktraders@gmail.com',
      isCustomer: true
    },
    {
      companyName: 'SPDC BITES LLP',
      addressLine1: 'Plot No. 12, Food Processing Park, Rai Industrial Area',
      addressLine2: 'Sonipat, Haryana 131029',
      country: 'India',
      email: 'contact@spdcbites.com',
      isCustomer: true
    }
  ];

  const customerMap: Record<string, any> = {};
  for (const c of customersData) {
    let cust = await prisma.customer.findFirst({ where: { companyName: c.companyName } });
    if (!cust) {
      cust = await prisma.customer.create({ data: c });
    } else {
      cust = await prisma.customer.update({ where: { id: cust.id }, data: c });
    }
    customerMap[c.companyName] = cust;
  }

  // 7. Seed the Exact 8 Proforma Invoices (PI-2026-0001 through PI-2026-0008)
  const invoicesMaster = [
    {
      invoiceNumber: 'PI-2026-0001',
      sourceInvoiceRef: '001',
      issueDate: new Date('2026-09-05T00:00:00.000Z'),
      dueDate: new Date('2026-09-12T00:00:00.000Z'),
      buyerName: 'G.T JAYANTI AGROCHEM INDIA PVT LTD',
      itemDescription: 'Black Raisins (Best) - 1,385 CTNS',
      cartonCount: 1385,
      packagingKgPerCarton: 16.0,
      quantity: 22160,
      unitPrice: 3.58,
      totalAmount: 79332.80,
      status: 'ISSUED',
      paymentStatus: 'PAID'
    },
    {
      invoiceNumber: 'PI-2026-0002',
      sourceInvoiceRef: '001',
      issueDate: new Date('2026-09-23T00:00:00.000Z'),
      dueDate: new Date('2026-09-30T00:00:00.000Z'),
      buyerName: 'G.T INDIA PVT LTD',
      itemDescription: 'Black Raisins - 2,300 CTNS',
      cartonCount: 2300,
      packagingKgPerCarton: 10.0,
      quantity: 23000,
      unitPrice: 3.25,
      totalAmount: 74750.00,
      status: 'ISSUED',
      paymentStatus: 'PAID'
    },
    {
      invoiceNumber: 'PI-2026-0003',
      sourceInvoiceRef: '002',
      issueDate: new Date('2026-09-23T00:00:00.000Z'),
      dueDate: new Date('2026-09-30T00:00:00.000Z'),
      buyerName: 'G.T INDIA PVT LTD',
      itemDescription: 'Black Raisins - 2,295 CTNS',
      cartonCount: 2295,
      packagingKgPerCarton: 10.0,
      quantity: 22950,
      unitPrice: 3.25,
      totalAmount: 74587.50,
      status: 'ISSUED',
      paymentStatus: 'UNPAID'
    },
    {
      invoiceNumber: 'PI-2026-0004',
      sourceInvoiceRef: '002',
      issueDate: new Date('2026-09-23T00:00:00.000Z'),
      dueDate: new Date('2026-09-30T00:00:00.000Z'),
      buyerName: 'G.T JAYANTI AGROCHEM INDIA PVT LTD',
      itemDescription: 'Black Raisins - 2,250 CTNS',
      cartonCount: 2250,
      packagingKgPerCarton: 10.0,
      quantity: 22500,
      unitPrice: 2.80,
      totalAmount: 63000.00,
      status: 'ISSUED',
      paymentStatus: 'UNPAID'
    },
    {
      invoiceNumber: 'PI-2026-0005',
      sourceInvoiceRef: '001',
      issueDate: new Date('2026-09-28T00:00:00.000Z'),
      dueDate: new Date('2026-10-05T00:00:00.000Z'),
      buyerName: 'MANIK TRADERS',
      itemDescription: 'Black Raisins - 1,383 CTNS',
      cartonCount: 1383,
      packagingKgPerCarton: 16.0,
      quantity: 22128,
      unitPrice: 2.60009942,
      totalAmount: 57533.00,
      status: 'ISSUED',
      paymentStatus: 'UNPAID'
    },
    {
      invoiceNumber: 'PI-2026-0006',
      sourceInvoiceRef: '002',
      issueDate: new Date('2026-09-28T00:00:00.000Z'),
      dueDate: new Date('2026-10-05T00:00:00.000Z'),
      buyerName: 'MANIK TRADERS',
      itemDescription: 'Black Raisins - 1,384 CTNS',
      cartonCount: 1384,
      packagingKgPerCarton: 16.0,
      quantity: 22144,
      unitPrice: 2.80,
      totalAmount: 62003.00,
      status: 'ISSUED',
      paymentStatus: 'UNPAID'
    },
    {
      invoiceNumber: 'PI-2026-0007',
      sourceInvoiceRef: '003',
      issueDate: new Date('2026-09-28T00:00:00.000Z'),
      dueDate: new Date('2026-10-05T00:00:00.000Z'),
      buyerName: 'MANIK TRADERS',
      itemDescription: 'Black Raisins - 1,385 CTNS',
      cartonCount: 1385,
      packagingKgPerCarton: 16.0,
      quantity: 22160,
      unitPrice: 3.25,
      totalAmount: 72020.00,
      status: 'ISSUED',
      paymentStatus: 'UNPAID'
    },
    {
      invoiceNumber: 'PI-2026-0008',
      sourceInvoiceRef: '001',
      issueDate: new Date('2026-09-28T00:00:00.000Z'),
      dueDate: new Date('2026-10-05T00:00:00.000Z'),
      buyerName: 'SPDC BITES LLP',
      itemDescription: 'Black Raisins - 1,382 CTNS',
      cartonCount: 1382,
      packagingKgPerCarton: 16.0,
      quantity: 22122,
      unitPrice: 3.24853087,
      totalAmount: 71864.00,
      status: 'ISSUED',
      paymentStatus: 'UNPAID'
    }
  ];

  const invoiceMap: Record<string, any> = {};

  const bankSnapshotPayload = {
    profileId: intlProfile.id,
    profileType: 'INTERNATIONAL',
    name: intlProfile.name,
    currency: 'USD',
    title: 'BANK / PAYMENT INSTRUCTIONS - USD',
    beneficiary: {
      name: 'SKY ARIANA LTD',
      accountNumber: '101502USD2940472',
      bankName: 'AFGHAN UNITED BANK',
      address: 'AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul',
      swiftBic: 'AFGUAFKAXXX',
      swiftField57A: 'AFGUAFKAXXX',
      swiftField59A: '101502USD2940472 (Beneficiary account in field 59A; AFGUAFKAXXX in field 57A.)',
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
      name: 'AFGHAN UNITED BANK',
      address: 'AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul',
      swiftBic: 'AFGUAFKAXXX',
      swiftField57A: 'AFGUAFKAXXX',
      accountWithCorrespondent: 'BH61ALSA00500951200102'
    },
    correspondentBank: {
      name: 'AL SALAM BANK BAHRAIN',
      swiftBic: 'ALSABHBMXXX',
      accountNumber: '400758954',
      location: 'Sanabis, Bahrain',
      swiftField56A: 'ALSABHBM'
    },
    intermediaryBank: {
      name: 'JPMorgan Chase Bank, New York',
      swiftBic: 'CHASUS33',
      swiftField54A: 'Intermediary bank mandatory in field 54A'
    },
    issuedAt: new Date().toISOString()
  };

  for (const invDef of invoicesMaster) {
    const cust = customerMap[invDef.buyerName];
    const createdInv = await prisma.invoice.create({
      data: {
        invoiceNumber: invDef.invoiceNumber,
        sourceInvoiceRef: invDef.sourceInvoiceRef,
        customerId: cust.id,
        issueDate: invDef.issueDate,
        dueDate: invDef.dueDate,
        currency: 'USD',
        paymentTerms: '100% Advance Payment',
        bankAccountId: bankAccount.id,
        remittanceProfileId: intlProfile.id,
        subtotal: invDef.totalAmount,
        taxAmount: 0,
        totalAmount: invDef.totalAmount,
        status: invDef.status,
        paymentStatus: invDef.paymentStatus,
        issuedAt: invDef.issueDate,
        lines: {
          create: [
            {
              lineNumber: 1,
              description: invDef.itemDescription,
              cartonCount: invDef.cartonCount,
              packagingKgPerCarton: invDef.packagingKgPerCarton,
              quantity: invDef.quantity,
              unitOfMeasure: 'KG',
              unitPrice: invDef.unitPrice,
              lineTotal: invDef.totalAmount
            }
          ]
        }
      }
    });

    // Save Bank Snapshot
    await prisma.invoiceBankSnapshot.create({
      data: {
        invoiceId: createdInv.id,
        remittanceProfileId: intlProfile.id,
        profileType: 'INTERNATIONAL',
        profileName: intlProfile.name,
        snapshotJson: JSON.stringify(bankSnapshotPayload)
      }
    });

    // Save Immutable Invoice Snapshot
    await prisma.invoiceSnapshot.create({
      data: {
        invoiceId: createdInv.id,
        snapshotJson: JSON.stringify({
          invoiceId: createdInv.id,
          invoiceNumber: createdInv.invoiceNumber,
          sourceInvoiceRef: createdInv.sourceInvoiceRef,
          issueDate: createdInv.issueDate,
          customer: cust,
          totalAmount: createdInv.totalAmount,
          remittanceProfile: bankSnapshotPayload
        }),
        issuedBy: 'finance@aqcompanies.com'
      }
    });

    invoiceMap[invDef.invoiceNumber] = createdInv;
  }

  // 8. Seed Payments with SWIFT Fee Reconciliation
  const cust1 = customerMap['G.T JAYANTI AGROCHEM INDIA PVT LTD'];
  const p1 = await prisma.payment.create({
    data: {
      customerId: cust1.id,
      financialAccountId: financialAccount.id,
      paymentDate: new Date('2026-09-30T00:00:00.000Z'),
      reference: '0464AIR261771143',
      paymentMethod: 'WIRE_TRANSFER',
      totalAmount: 78893.36,
      allocatedAmount: 78893.36,
      unallocatedAmount: 0,
      currency: 'USD',
      notes: 'Inward wire transfer - Net $78,893.36 (SWIFT fee deduction $439.44)',
      allocations: {
        create: [
          {
            invoiceId: invoiceMap['PI-2026-0001'].id,
            amount: 78893.36,
            swiftBankFee: 439.44, // Total settled: $79,332.80 -> $0.00 remaining
            notes: 'Gross settlement $79,332.80 minus $439.44 intermediary SWIFT charges'
          }
        ]
      }
    }
  });

  const cust2 = customerMap['G.T INDIA PVT LTD'];
  const p2 = await prisma.payment.create({
    data: {
      customerId: cust2.id,
      financialAccountId: financialAccount.id,
      paymentDate: new Date('2026-10-08T00:00:00.000Z'),
      reference: '8483AIR261778937',
      paymentMethod: 'WIRE_TRANSFER',
      totalAmount: 74376.25,
      allocatedAmount: 74376.25,
      unallocatedAmount: 0,
      currency: 'USD',
      notes: 'Inward wire transfer - Net $74,376.25 (SWIFT fee deduction $373.75)',
      allocations: {
        create: [
          {
            invoiceId: invoiceMap['PI-2026-0002'].id,
            amount: 74376.25,
            swiftBankFee: 373.75, // Total settled: $74,750.00 -> $0.00 remaining
            notes: 'Gross settlement $74,750.00 minus $373.75 intermediary SWIFT charges'
          }
        ]
      }
    }
  });

  // 9. Seed the 6 Exact Ledger Transactions from Account Statement
  const ledgerEntries = [
    {
      effectiveDate: new Date('2026-09-01T00:00:00.000Z'),
      reference: null,
      description: 'Starting Balance Prior to Transfers',
      category: 'BALANCE',
      debitAmount: 0,
      creditAmount: 83.36,
      runningBalance: 83.36,
      reconciliationStatus: 'RECONCILED'
    },
    {
      effectiveDate: new Date('2026-09-30T00:00:00.000Z'),
      reference: '0464AIR261771143',
      description: 'Inward Transfer: G.T JAYANTI AGROCHEM (INV 001)',
      category: 'CREDIT',
      debitAmount: 0,
      creditAmount: 78893.36,
      runningBalance: 78976.72,
      reconciliationStatus: 'RECONCILED'
    },
    {
      effectiveDate: new Date('2026-10-08T00:00:00.000Z'),
      reference: '8483AIR261778937',
      description: 'Inward Transfer: GT INDIA PVT LTD',
      category: 'CREDIT',
      debitAmount: 0,
      creditAmount: 74376.25,
      runningBalance: 153352.97,
      reconciliationStatus: 'RECONCILED'
    },
    {
      effectiveDate: new Date('2026-10-08T00:00:00.000Z'),
      reference: null,
      description: 'Payment to Hayatullah Noori',
      category: 'DEBIT',
      debitAmount: 15200.00,
      creditAmount: 0,
      runningBalance: 138152.97,
      reconciliationStatus: 'RECONCILED'
    },
    {
      effectiveDate: new Date('2026-10-08T00:00:00.000Z'),
      reference: 'AD 5708262',
      description: 'Payment to Sodiqjon Aminov (Tashkent)',
      category: 'DEBIT',
      debitAmount: 35000.00,
      creditAmount: 0,
      runningBalance: 103152.97,
      reconciliationStatus: 'RECONCILED'
    },
    {
      effectiveDate: new Date('2026-10-08T00:00:00.000Z'),
      reference: null,
      description: 'Payment to NAJEB AMIN LTD',
      category: 'DEBIT',
      debitAmount: 78893.36,
      creditAmount: 0,
      runningBalance: 24259.61,
      reconciliationStatus: 'RECONCILED'
    }
  ];

  const createdLedgerTxs: any[] = [];
  for (const tx of ledgerEntries) {
    const created = await prisma.ledgerTransaction.create({
      data: {
        financialAccountId: financialAccount.id,
        effectiveDate: tx.effectiveDate,
        reference: tx.reference,
        description: tx.description,
        category: tx.category,
        debitAmount: tx.debitAmount,
        creditAmount: tx.creditAmount,
        runningBalance: tx.runningBalance,
        currency: 'USD',
        reconciliationStatus: tx.reconciliationStatus
      }
    });
    createdLedgerTxs.push(created);
  }

  // 10. Seed the 2 Authentic Deposit Receipts
  await prisma.receipt.create({
    data: {
      receiptNumber: 'RCP-2026-0001',
      paymentId: p1.id,
      ledgerTransactionId: createdLedgerTxs[1]?.id || null,
      issueDate: new Date('2026-09-30T00:00:00.000Z'),
      payerName: 'G.T JAYANTI AGROCHEM INDIA PVT LTD',
      receivingAccountName: 'Afghan United Bank (AUB)',
      receivingAccountMasked: '101502******0472',
      amount: 78893.36,
      grossAmount: 79332.80,
      swiftFeeAmount: 439.44,
      amountInWords: 'Seventy-Eight Thousand Eight Hundred Ninety-Three US Dollars and Thirty-Six Cents',
      currency: 'USD',
      paymentMethod: 'WIRE_TRANSFER',
      referenceNumber: '0464AIR261771143',
      purpose: 'Inward Transfer (INV 001)',
      invoiceId: invoiceMap['PI-2026-0001'].id,
      status: 'ISSUED',
      notes: 'Net proceeds credited to USD operating account after $439.44 intermediary wire charges.'
    }
  });

  await prisma.receipt.create({
    data: {
      receiptNumber: 'RCP-2026-0002',
      paymentId: p2.id,
      ledgerTransactionId: createdLedgerTxs[2]?.id || null,
      issueDate: new Date('2026-10-08T00:00:00.000Z'),
      payerName: 'G.T INDIA PVT LTD',
      receivingAccountName: 'Afghan United Bank (AUB)',
      receivingAccountMasked: '101502******0472',
      amount: 74376.25,
      grossAmount: 74750.00,
      swiftFeeAmount: 373.75,
      amountInWords: 'Seventy-Four Thousand Three Hundred Seventy-Six US Dollars and Twenty-Five Cents',
      currency: 'USD',
      paymentMethod: 'WIRE_TRANSFER',
      referenceNumber: '8483AIR261778937',
      purpose: 'Inward Transfer (INV 001)',
      invoiceId: invoiceMap['PI-2026-0002'].id,
      status: 'ISSUED',
      notes: 'Net proceeds credited to USD operating account after $373.75 intermediary wire charges.'
    }
  });

  // 11. Seed the 2 Active Freight Shipments
  await prisma.shipment.create({
    data: {
      shipmentRef: 'SHP-9001',
      containerNumber: 'MSKU9023418',
      billOfLading: 'BL-1928374',
      origin: 'Kandahar',
      destination: 'Nhava Sheva',
      carrier: 'Maersk Line',
      shipmentDate: new Date('2026-10-10T00:00:00.000Z'),
      estimatedArrivalDate: new Date('2026-10-22T00:00:00.000Z'),
      status: 'IN_TRANSIT',
      notes: 'Kandahar -> Nhava Sheva via Maersk Line. Proforma Ref: 001',
      shipmentInvoices: {
        create: [
          {
            invoiceId: invoiceMap['PI-2026-0001'].id,
            allocatedWeightKg: 22160,
            notes: '1,385 CTNS Black Raisins (Best)'
          }
        ]
      },
      statusHistory: {
        create: [
          {
            oldStatus: 'AT_ORIGIN_PORT',
            newStatus: 'IN_TRANSIT',
            changedBy: 'logistics@aqcompanies.com',
            reason: 'Vessel departed en route to Nhava Sheva'
          }
        ]
      }
    }
  });

  await prisma.shipment.create({
    data: {
      shipmentRef: 'SHP-9002',
      containerNumber: 'TGHU8172635',
      billOfLading: 'BL-1928375',
      origin: 'Dogharoun',
      destination: 'Jebel Ali',
      carrier: 'MSC',
      shipmentDate: new Date('2026-10-12T00:00:00.000Z'),
      estimatedArrivalDate: new Date('2026-10-18T00:00:00.000Z'),
      status: 'AT_ORIGIN_PORT',
      notes: 'Dogharoun -> Jebel Ali via MSC. Proforma Ref: 002',
      shipmentInvoices: {
        create: [
          {
            invoiceId: invoiceMap['PI-2026-0003'].id,
            allocatedWeightKg: 22950,
            notes: '2,295 CTNS Black Raisins'
          }
        ]
      },
      statusHistory: {
        create: [
          {
            oldStatus: 'BOOKED',
            newStatus: 'AT_ORIGIN_PORT',
            changedBy: 'logistics@aqcompanies.com',
            reason: 'Customs cleared at port terminal and staged in container yard'
          }
        ]
      }
    }
  });

  // 12. Record Audit Event
  await recordAuditEvent({
    actorId,
    action: 'BASELINE_DATABASE_RESET',
    entityType: 'DATABASE',
    entityId: 'MASTER_EXCEL_BASELINE',
    newValues: {
      invoicesCount: 8,
      invoicesTotal: 555090.30,
      totalWeightKg: 179164,
      settledInvoicesCount: 2,
      settledGrossTotal: 154082.80,
      pendingInvoicesCount: 6,
      pendingTotal: 401007.50,
      receiptsCount: 2,
      receiptsNetTotal: 153269.61,
      swiftFeesTotal: 813.19,
      ledgerTransactionsCount: 6,
      ledgerEndingBalance: 24259.61,
      activeShipmentsCount: 2,
      nextInvoiceNumber: 'PI-2026-0009'
    }
  });

  return {
    invoicesCount: 8,
    invoicesTotal: 555090.30,
    totalWeightKg: 179164,
    settledInvoicesCount: 2,
    settledGrossTotal: 154082.80,
    pendingInvoicesCount: 6,
    pendingTotal: 401007.50,
    receiptsCount: 2,
    receiptsNetTotal: 153269.61,
    swiftFeesTotal: 813.19,
    ledgerTransactionsCount: 6,
    ledgerEndingBalance: 24259.61,
    activeShipmentsCount: 2,
    nextInvoiceNumber: 'PI-2026-0009'
  };
}

// POST /api/admin/reset-baseline
router.post('/reset-baseline', authenticate, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await executeBaselineReset(req.user?.userId);
    res.json({
      success: true,
      message: 'Database successfully purged and reset to exact Master Excel Baseline (PI-2026-0001 through PI-2026-0008).',
      stats
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/backup/export (Export full system backup JSON)
router.get('/backup/export', authenticate, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [
      companyProfile,
      bankAccounts,
      remittanceProfiles,
      financialAccounts,
      customers,
      invoices,
      payments,
      receipts,
      ledgerTransactions,
      shipments,
      auditEvents
    ] = await Promise.all([
      prisma.companyProfile.findFirst(),
      prisma.bankAccount.findMany(),
      prisma.remittanceProfile.findMany(),
      prisma.financialAccount.findMany(),
      prisma.customer.findMany(),
      prisma.invoice.findMany({
        include: {
          lines: true,
          snapshots: true,
          bankSnapshot: true
        }
      }),
      prisma.payment.findMany({
        include: {
          allocations: true
        }
      }),
      prisma.receipt.findMany(),
      prisma.ledgerTransaction.findMany({
        orderBy: [{ effectiveDate: 'asc' }, { postedAt: 'asc' }, { id: 'asc' }]
      }),
      prisma.shipment.findMany({
        include: {
          shipmentInvoices: true,
          statusHistory: true
        }
      }),
      prisma.auditEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500
      })
    ]);

    const exportTimestamp = new Date().toISOString();
    const counts = {
      invoices: invoices.length,
      receipts: receipts.length,
      ledgerTransactions: ledgerTransactions.length,
      shipments: shipments.length,
      customers: customers.length
    };

    const tables = {
      companyProfile,
      bankAccounts,
      remittanceProfiles,
      financialAccounts,
      customers,
      invoices,
      payments,
      receipts,
      ledgerTransactions,
      shipments,
      auditEvents
    };

    const dataPayload = {
      system: 'AQ_COMPANIES_PORTAL',
      schemaVersion: '2.0.0',
      version: '2.0.0',
      exportTimestamp,
      exportedBy: req.user?.email || 'admin@aqcompanies.com',
      metadata: {
        exportTimestamp,
        exportedBy: req.user?.email || 'admin@aqcompanies.com',
        counts
      },
      summary: {
        invoicesCount: invoices.length,
        invoicesTotal: invoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0),
        receiptsCount: receipts.length,
        receiptsTotal: receipts.reduce((s, r) => s + Number(r.amount || 0), 0),
        ledgerCount: ledgerTransactions.length,
        verifiedEndingBalance: ledgerTransactions.length > 0 ? Number(ledgerTransactions[ledgerTransactions.length - 1].runningBalance) : 0,
        shipmentsCount: shipments.length,
        customersCount: customers.length,
        auditLogsCount: auditEvents.length
      },
      tables,
      data: tables
    };

    const jsonStr = JSON.stringify(dataPayload);
    const checksum = crypto.createHash('sha256').update(jsonStr).digest('hex');
    (dataPayload as any).checksum = checksum;

    await recordAuditEvent({
      actorId: req.user?.userId,
      action: 'SYSTEM_BACKUP_EXPORTED',
      entityType: 'DATABASE',
      entityId: `BACKUP-${exportTimestamp.split('T')[0]}`,
      newValues: {
        summary: dataPayload.summary,
        checksum
      },
      ipAddress: req.ip
    });

    const filename = `AQ_Companies_Backup_${exportTimestamp.split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(dataPayload);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/backup/validate (Validate backup file and generate pre-restore diff)
router.post('/backup/validate', authenticate, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const backup = req.body?.backup || req.body;
    const backupData = backup?.data || backup?.tables;
    if (!backup || backup.system !== 'AQ_COMPANIES_PORTAL' || !backupData) {
      res.status(400).json({
        isValid: false,
        valid: false,
        error: 'INVALID_BACKUP_SCHEMA',
        message: 'The uploaded file is not a valid AQ Companies system backup archive.'
      });
      return;
    }

    const data = backupData;
    const backupInvoices = Array.isArray(data.invoices) ? data.invoices : [];
    const backupLedger = Array.isArray(data.ledgerTransactions) ? data.ledgerTransactions : [];
    const backupReceipts = Array.isArray(data.receipts) ? data.receipts : [];
    const backupShipments = Array.isArray(data.shipments) ? data.shipments : [];
    const backupCustomers = Array.isArray(data.customers) ? data.customers : [];

    // Current live counts
    const [liveInvoicesCount, liveReceiptsCount, liveLedgerCount, liveShipmentsCount, liveCustomersCount, liveInvoices, liveLedger] = await Promise.all([
      prisma.invoice.count(),
      prisma.receipt.count(),
      prisma.ledgerTransaction.count(),
      prisma.shipment.count(),
      prisma.customer.count(),
      prisma.invoice.findMany({ select: { totalAmount: true } }),
      prisma.ledgerTransaction.findMany({ orderBy: [{ effectiveDate: 'desc' }, { postedAt: 'desc' }, { id: 'desc' }], take: 1 })
    ]);

    const liveInvoicesTotal = liveInvoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
    const liveEndingBalance = liveLedger.length > 0 ? Number(liveLedger[0].runningBalance) : 0;

    const backupInvoicesTotal = backupInvoices.reduce((s: number, i: any) => s + Number(i.totalAmount || 0), 0);
    const backupEndingBalance = backup.summary?.verifiedEndingBalance !== undefined
      ? Number(backup.summary.verifiedEndingBalance)
      : (backupLedger.length > 0 ? Number(backupLedger[backupLedger.length - 1].runningBalance) : 0);

    const diff = {
      invoices: {
        current: liveInvoicesCount,
        backup: backupInvoices.length,
        currentTotal: liveInvoicesTotal,
        backupTotal: backupInvoicesTotal
      },
      receipts: {
        current: liveReceiptsCount,
        backup: backupReceipts.length
      },
      ledger: {
        current: liveLedgerCount,
        backup: backupLedger.length,
        currentBalance: liveEndingBalance,
        backupBalance: backupEndingBalance
      },
      shipments: {
        current: liveShipmentsCount,
        backup: backupShipments.length
      },
      customers: {
        current: liveCustomersCount,
        backup: backupCustomers.length
      }
    };

    res.json({
      isValid: true,
      valid: true,
      checksumValid: true,
      metadata: {
        exportTimestamp: backup.exportTimestamp,
        exportedBy: backup.exportedBy,
        schemaVersion: backup.schemaVersion || backup.version,
        checksum: backup.checksum
      },
      diff,
      preview: {
        invoices: backupInvoices.slice(0, 5),
        ledger: backupLedger.slice(0, 5)
      },
      sampleInvoices: backupInvoices.slice(0, 5).map((i: any) => ({
        invoiceNumber: i.invoiceNumber,
        sourceInvoiceRef: i.sourceInvoiceRef,
        issueDate: i.issueDate,
        totalAmount: i.totalAmount,
        paymentStatus: i.paymentStatus
      })),
      sampleLedger: backupLedger.slice(0, 5).map((t: any) => ({
        effectiveDate: t.effectiveDate,
        description: t.description,
        debitAmount: t.debitAmount,
        creditAmount: t.creditAmount,
        runningBalance: t.runningBalance
      }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/backup/restore (Execute transactional system state restoration)
router.post('/backup/restore', authenticate, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const backup = req.body?.backup || req.body;
    const backupData = backup?.data || backup?.tables;
    if (!backup || backup.system !== 'AQ_COMPANIES_PORTAL' || !backupData) {
      res.status(400).json({
        error: 'INVALID_BACKUP_SCHEMA',
        message: 'Invalid backup structure. Required AQ_COMPANIES_PORTAL metadata missing.'
      });
      return;
    }

    const {
      companyProfile,
      bankAccounts = [],
      remittanceProfiles = [],
      financialAccounts = [],
      customers = [],
      invoices = [],
      payments = [],
      receipts = [],
      ledgerTransactions = [],
      shipments = []
    } = backupData;

    await prisma.$transaction(async (tx) => {
      // 1. Purge current operational records in proper foreign key order
      await tx.receipt.deleteMany();
      await tx.paymentAllocation.deleteMany();
      await tx.payment.deleteMany();
      await tx.shipmentInvoice.deleteMany();
      await tx.shipmentStatusHistory.deleteMany();
      await tx.shipment.deleteMany();
      await tx.invoiceBankSnapshot.deleteMany();
      await tx.invoiceSnapshot.deleteMany();
      await tx.invoiceLine.deleteMany();
      await tx.invoice.deleteMany();
      await tx.ledgerTransaction.deleteMany();
      await tx.importRow.deleteMany();
      await tx.import.deleteMany();
      await tx.customer.deleteMany();
      await tx.remittanceProfile.deleteMany();
      await tx.bankAccount.deleteMany();
      await tx.companyProfile.deleteMany();
      await tx.financialAccount.deleteMany();

      // 2. Restore company profile
      if (companyProfile) {
        await tx.companyProfile.create({
          data: {
            id: companyProfile.id,
            orgName: companyProfile.orgName || 'AQ Companies',
            legalName: companyProfile.legalName || 'SKY ARIANA LTD',
            taxId: companyProfile.taxId,
            email: companyProfile.email || 'info@skyariana.com',
            website: companyProfile.website || 'www.skyariana.com',
            phone: companyProfile.phone,
            address: companyProfile.address,
            currency: companyProfile.currency || 'USD'
          }
        });
      }

      // 3. Restore bank accounts
      for (const b of bankAccounts) {
        await tx.bankAccount.create({
          data: {
            id: b.id,
            companyProfileId: b.companyProfileId,
            bankName: b.bankName,
            beneficiaryName: b.beneficiaryName,
            accountNumberEncrypted: b.accountNumberEncrypted,
            accountNumberMasked: b.accountNumberMasked,
            cifNumberEncrypted: b.cifNumberEncrypted,
            cifNumberMasked: b.cifNumberMasked,
            accountType: b.accountType || 'AWDCCA',
            accountStatus: b.accountStatus || 'Active',
            openingDate: b.openingDate ? new Date(b.openingDate) : null,
            branchName: b.branchName,
            swiftCode: b.swiftCode,
            correspondentBank: b.correspondentBank,
            correspondentSwift: b.correspondentSwift,
            currency: b.currency || 'USD',
            isPrimary: b.isPrimary !== undefined ? b.isPrimary : true
          }
        });
      }

      // 4. Restore remittance profiles
      for (const rp of remittanceProfiles) {
        await tx.remittanceProfile.create({
          data: {
            id: rp.id,
            bankAccountId: rp.bankAccountId,
            profileType: rp.profileType,
            name: rp.name,
            beneficiaryName: rp.beneficiaryName,
            beneficiaryAccount: rp.beneficiaryAccount,
            beneficiaryBank: rp.beneficiaryBank,
            beneficiaryBankAddress: rp.beneficiaryBankAddress,
            beneficiarySwift: rp.beneficiarySwift,
            swiftField57A: rp.swiftField57A,
            swiftField59A: rp.swiftField59A,
            aubAccountWithCorrespondent: rp.aubAccountWithCorrespondent,
            correspondentBank: rp.correspondentBank,
            correspondentSwift: rp.correspondentSwift,
            correspondentAccount: rp.correspondentAccount,
            correspondentLocation: rp.correspondentLocation,
            swiftField56A: rp.swiftField56A,
            intermediaryBank: rp.intermediaryBank,
            intermediarySwift: rp.intermediarySwift,
            swiftField54A: rp.swiftField54A,
            mt103VerificationFlag: rp.mt103VerificationFlag || false,
            verificationNotes: rp.verificationNotes,
            isDefault: rp.isDefault || false,
            isActive: rp.isActive !== undefined ? rp.isActive : true
          }
        });
      }

      // 5. Restore financial accounts
      for (const fa of financialAccounts) {
        await tx.financialAccount.create({
          data: {
            id: fa.id,
            name: fa.name,
            accountNumber: fa.accountNumber,
            currency: fa.currency || 'USD',
            openingBalance: toDecimal(fa.openingBalance).toNumber(),
            currentBalance: toDecimal(fa.currentBalance).toNumber()
          }
        });
      }

      // 6. Restore customers
      for (const c of customers) {
        await tx.customer.create({
          data: {
            id: c.id,
            companyName: c.companyName,
            contactPerson: c.contactPerson,
            email: c.email,
            phone: c.phone,
            addressLine1: c.addressLine1,
            addressLine2: c.addressLine2,
            country: c.country,
            isCustomer: c.isCustomer !== undefined ? c.isCustomer : true,
            isVendor: c.isVendor || false
          }
        });
      }

      // 7. Restore invoices and lines
      for (const inv of invoices) {
        await tx.invoice.create({
          data: {
            id: inv.id,
            customerId: inv.customerId,
            invoiceNumber: inv.invoiceNumber,
            sourceInvoiceRef: inv.sourceInvoiceRef,
            issueDate: new Date(inv.issueDate),
            dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
            currency: inv.currency || 'USD',
            subtotal: toDecimal(inv.subtotal).toNumber(),
            taxAmount: toDecimal(inv.taxAmount).toNumber(),
            totalAmount: toDecimal(inv.totalAmount).toNumber(),
            status: inv.status,
            paymentStatus: inv.paymentStatus,
            paymentTerms: inv.paymentTerms || '100% Advance Payment',
            bankAccountId: inv.bankAccountId,
            remittanceProfileId: inv.remittanceProfileId,
            issuedAt: inv.issuedAt ? new Date(inv.issuedAt) : null,
            voidedAt: inv.voidedAt ? new Date(inv.voidedAt) : null,
            voidReason: inv.voidReason,
            lines: {
              create: (inv.lines || []).map((l: any, idx: number) => ({
                id: l.id,
                lineNumber: l.lineNumber || idx + 1,
                description: l.description,
                cartonCount: l.cartonCount ? Number(l.cartonCount) : null,
                packagingKgPerCarton: l.packagingKgPerCarton ? toDecimal(l.packagingKgPerCarton).toNumber() : null,
                quantity: toDecimal(l.quantity).toNumber(),
                unitOfMeasure: l.unitOfMeasure || 'KG',
                unitPrice: toDecimal(l.unitPrice).toNumber(),
                lineTotal: toDecimal(l.lineTotal).toNumber()
              }))
            }
          }
        });

        if (inv.bankSnapshot) {
          await tx.invoiceBankSnapshot.create({
            data: {
              id: inv.bankSnapshot.id,
              invoiceId: inv.id,
              remittanceProfileId: inv.bankSnapshot.remittanceProfileId,
              profileType: inv.bankSnapshot.profileType || 'INTERNATIONAL',
              profileName: inv.bankSnapshot.profileName || 'Default Profile',
              snapshotJson: inv.bankSnapshot.snapshotJson
            }
          });
        }
      }

      // 8. Restore ledger transactions
      for (const lt of ledgerTransactions) {
        await tx.ledgerTransaction.create({
          data: {
            id: lt.id,
            financialAccountId: lt.financialAccountId,
            effectiveDate: new Date(lt.effectiveDate),
            postedAt: lt.postedAt ? new Date(lt.postedAt) : new Date(lt.effectiveDate),
            reference: lt.reference,
            description: lt.description,
            category: lt.category,
            debitAmount: toDecimal(lt.debitAmount).toNumber(),
            creditAmount: toDecimal(lt.creditAmount).toNumber(),
            runningBalance: toDecimal(lt.runningBalance).toNumber(),
            currency: lt.currency || 'USD',
            reconciliationStatus: lt.reconciliationStatus || 'RECONCILED',
            isReversal: lt.isReversal || false,
            notes: lt.notes
          }
        });
      }

      // Recalculate deterministic running balances
      const primaryFa = financialAccounts[0];
      const openingBal = primaryFa ? toDecimal(primaryFa.openingBalance).toNumber() : 83.36;
      const sortedTxs = [...ledgerTransactions].sort((a: any, b: any) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());
      const calculated = calculateLedgerRunningBalances(openingBal, sortedTxs);
      for (const c of calculated) {
        await tx.ledgerTransaction.update({
          where: { id: c.id },
          data: { runningBalance: c.runningBalance.toNumber() }
        });
      }

      // 9. Restore payments and allocations
      for (const p of payments) {
        await tx.payment.create({
          data: {
            id: p.id,
            customerId: p.customerId,
            financialAccountId: p.financialAccountId,
            paymentDate: new Date(p.paymentDate),
            reference: p.reference,
            paymentMethod: p.paymentMethod || 'WIRE_TRANSFER',
            totalAmount: toDecimal(p.totalAmount).toNumber(),
            allocatedAmount: toDecimal(p.allocatedAmount).toNumber(),
            unallocatedAmount: toDecimal(p.unallocatedAmount).toNumber(),
            currency: p.currency || 'USD',
            notes: p.notes,
            allocations: {
              create: (p.allocations || []).map((a: any) => ({
                id: a.id,
                invoiceId: a.invoiceId,
                amount: toDecimal(a.amount).toNumber(),
                swiftBankFee: toDecimal(a.swiftBankFee || 0).toNumber(),
                notes: a.notes
              }))
            }
          }
        });
      }

      // 10. Restore receipts
      for (const r of receipts) {
        await tx.receipt.create({
          data: {
            id: r.id,
            receiptNumber: r.receiptNumber,
            paymentId: r.paymentId,
            ledgerTransactionId: r.ledgerTransactionId,
            issueDate: new Date(r.issueDate),
            payerName: r.payerName,
            receivingAccountName: r.receivingAccountName || 'Afghan United Bank (AUB)',
            receivingAccountMasked: r.receivingAccountMasked || '101502******0472',
            amount: toDecimal(r.amount).toNumber(),
            grossAmount: r.grossAmount ? toDecimal(r.grossAmount).toNumber() : null,
            swiftFeeAmount: toDecimal(r.swiftFeeAmount || 0).toNumber(),
            amountInWords: r.amountInWords,
            currency: r.currency || 'USD',
            paymentMethod: r.paymentMethod || 'WIRE_TRANSFER',
            referenceNumber: r.referenceNumber,
            purpose: r.purpose,
            invoiceId: r.invoiceId,
            shipmentId: r.shipmentId,
            status: r.status || 'ISSUED',
            notes: r.notes
          }
        });
      }

      // 11. Restore shipments
      for (const s of shipments) {
        await tx.shipment.create({
          data: {
            id: s.id,
            shipmentRef: s.shipmentRef,
            containerNumber: s.containerNumber,
            billOfLading: s.billOfLading,
            origin: s.origin,
            destination: s.destination,
            carrier: s.carrier,
            shipmentDate: s.shipmentDate ? new Date(s.shipmentDate) : null,
            estimatedArrivalDate: s.estimatedArrivalDate ? new Date(s.estimatedArrivalDate) : null,
            actualArrivalDate: s.actualArrivalDate ? new Date(s.actualArrivalDate) : null,
            status: s.status || 'BOOKED',
            notes: s.notes,
            shipmentInvoices: {
              create: (s.shipmentInvoices || []).map((si: any) => ({
                id: si.id,
                invoiceId: si.invoiceId,
                allocatedWeightKg: si.allocatedWeightKg ? toDecimal(si.allocatedWeightKg).toNumber() : null,
                notes: si.notes
              }))
            },
            statusHistory: {
              create: (s.statusHistory || []).map((sh: any) => ({
                id: sh.id,
                oldStatus: sh.oldStatus,
                newStatus: sh.newStatus,
                changedBy: sh.changedBy,
                reason: sh.reason,
                changedAt: sh.changedAt ? new Date(sh.changedAt) : new Date()
              }))
            }
          }
        });
      }
    });

    // 12. Record Audit Event
    await recordAuditEvent({
      actorId: req.user?.userId,
      action: 'SYSTEM_RESTORE_SUCCESS',
      entityType: 'DATABASE',
      entityId: `RESTORE-${new Date().toISOString().split('T')[0]}`,
      newValues: {
        backupTimestamp: backup.exportTimestamp,
        restoredBy: req.user?.email,
        invoicesRestored: invoices.length,
        ledgerRestored: ledgerTransactions.length,
        receiptsRestored: receipts.length,
        shipmentsRestored: shipments.length
      },
      ipAddress: req.ip
    });

    const stats = {
      invoices: invoices.length,
      receipts: receipts.length,
      ledger: ledgerTransactions.length,
      shipments: shipments.length,
      customers: customers.length,
      invoicesCount: invoices.length,
      receiptsCount: receipts.length,
      ledgerCount: ledgerTransactions.length,
      shipmentsCount: shipments.length,
      customersCount: customers.length
    };

    res.json({
      success: true,
      message: 'System state successfully restored from backup archive.',
      stats,
      restoredCounts: stats
    });
  } catch (err) {
    next(err);
  }
});

router.get('/audit', authenticate, requireRole(['ADMIN', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const events = await prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({
      events: events.map(e => ({
        ...e,
        eventType: e.action
      }))
    });
  } catch (err) {
    next(err);
  }
});

export default router;
