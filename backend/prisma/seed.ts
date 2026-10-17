import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING MASTER DATA ENVIRONMENT ---');

  // 1. Roles and Permissions
  const permissionsList = [
    { code: 'user:manage', description: 'Create and manage users and roles' },
    { code: 'settings:manage', description: 'Manage company profile and system configurations' },
    { code: 'invoice:create_draft', description: 'Create draft proforma invoices' },
    { code: 'invoice:issue', description: 'Issue and snapshot proforma invoices' },
    { code: 'invoice:void', description: 'Void issued proforma invoices' },
    { code: 'invoice:view', description: 'View proforma invoices and lines' },
    { code: 'ledger:post_entry', description: 'Post manual ledger entries' },
    { code: 'ledger:reverse_entry', description: 'Post reversing ledger adjustments' },
    { code: 'ledger:view', description: 'View ledger transactions and running balances' },
    { code: 'payment:create', description: 'Record customer payments' },
    { code: 'payment:allocate', description: 'Allocate payments to invoices' },
    { code: 'shipment:manage', description: 'Create and update freight shipments and tracking' },
    { code: 'shipment:view', description: 'View shipments and tracking status' },
    { code: 'bank_details:view_masked', description: 'View masked banking details' },
    { code: 'bank_details:reveal_unmasked', description: 'Audit-logged access to unmasked bank numbers' },
    { code: 'bank_details:manage', description: 'Create and edit company bank accounts' },
    { code: 'remittance:manage', description: 'Manage local and international remittance profiles' },
    { code: 'remittance:set_default', description: 'Set default invoice banking remittance profile' },
    { code: 'bank_details:export', description: 'Export or download official banking instructions' },
    { code: 'bank_details:view_history', description: 'View banking configuration change history' },
    { code: 'import:execute', description: 'Perform dry-run and commit imports from workbooks' },
    { code: 'audit:view', description: 'View system audit trails' }
  ];

  for (const p of permissionsList) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description },
      create: p
    });
  }

  const rolesDef = [
    {
      name: 'ADMIN',
      description: 'System administrator with unrestricted access',
      permissions: permissionsList.map(p => p.code)
    },
    {
      name: 'FINANCE_MANAGER',
      description: 'Manages invoicing, payments, ledger, and banking',
      permissions: [
        'invoice:create_draft', 'invoice:issue', 'invoice:void', 'invoice:view',
        'ledger:post_entry', 'ledger:reverse_entry', 'ledger:view',
        'payment:create', 'payment:allocate',
        'shipment:view',
        'bank_details:view_masked', 'bank_details:reveal_unmasked',
        'bank_details:manage', 'remittance:manage', 'remittance:set_default',
        'bank_details:export', 'bank_details:view_history',
        'import:execute', 'audit:view'
      ]
    },
    {
      name: 'LOGISTICS_COORDINATOR',
      description: 'Manages freight operations and cargo movements',
      permissions: [
        'shipment:manage', 'shipment:view',
        'invoice:view'
      ]
    },
    {
      name: 'AUDITOR',
      description: 'Compliance auditor with read-only financial & audit access',
      permissions: [
        'invoice:view', 'ledger:view', 'shipment:view',
        'bank_details:view_masked', 'bank_details:view_history', 'bank_details:export',
        'audit:view'
      ]
    },
    {
      name: 'VIEWER',
      description: 'Read-only dashboard viewer',
      permissions: [
        'invoice:view', 'shipment:view', 'ledger:view', 'bank_details:view_masked'
      ]
    }
  ];

  for (const r of rolesDef) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description }
    });

    for (const permCode of r.permissions) {
      const perm = await prisma.permission.findUnique({ where: { code: permCode } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id }
        });
      }
    }
  }

  // 2. Default Seed Users
  const defaultPasswordHash = await bcrypt.hash('AQCompanies@2026', 10);
  const ahsanullahPasswordHash = await bcrypt.hash('Qur78Ahs@@', 10);
  const danishPasswordHash = await bcrypt.hash('Danish123@789', 10);

  const usersToSeed = [
    { email: 'admin@aqcompanies.com', firstName: 'System', lastName: 'Administrator', role: 'ADMIN', passwordHash: defaultPasswordHash },
    { email: 'ahsanullah@aqcompanies.com', firstName: 'Ahsanullah', lastName: 'Qureshi', role: 'ADMIN', passwordHash: ahsanullahPasswordHash },
    { email: 'danish@aqcompanies.com', firstName: 'Danish', lastName: 'Qureshi', role: 'ADMIN', passwordHash: danishPasswordHash },
    { email: 'finance@aqcompanies.com', firstName: 'Ahmad', lastName: 'Finance', role: 'FINANCE_MANAGER', passwordHash: defaultPasswordHash },
    { email: 'logistics@aqcompanies.com', firstName: 'Tariq', lastName: 'Logistics', role: 'LOGISTICS_COORDINATOR', passwordHash: defaultPasswordHash },
    { email: 'auditor@aqcompanies.com', firstName: 'Sarah', lastName: 'Auditor', role: 'AUDITOR', passwordHash: defaultPasswordHash },
    { email: 'viewer@aqcompanies.com', firstName: 'Guest', lastName: 'Viewer', role: 'VIEWER', passwordHash: defaultPasswordHash }
  ];

  for (const u of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash: u.passwordHash,
        isActive: true
      },
      create: {
        email: u.email,
        passwordHash: u.passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: true
      }
    });

    const role = await prisma.role.findUnique({ where: { name: u.role } });
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id }
      });
    }
  }

  // 3. Organization Profile & Default Banking Details
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

  // 4. Primary Bank Account (Afghan United Bank - AUB)
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

  // 5. Remittance Profiles
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

  // 6. Primary Financial USD Account
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

  // 7. PURGE ALL TEST / GHOST / RESIDUAL DATA CLEANLY
  console.log('Purging test & previous operational data...');
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

  // 8. Seed the 4 Real Customers from Excel
  console.log('Seeding official customers...');
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

  // 9. Seed the Exact 8 Proforma Invoices (PI-2026-0001 through PI-2026-0008)
  console.log('Seeding exact 8 Proforma Invoices (PI-2026-0001 through PI-2026-0008)...');
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

  // 10. Seed Payments with SWIFT Fee Reconciliation
  console.log('Seeding settled payments...');
  // Payment 1 for PI-2026-0001 (Ref: 0464AIR261771143, Date: 2026-09-30)
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

  // Payment 2 for PI-2026-0002 (Ref: 8483AIR261778937, Date: 2026-10-08)
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

  // 11. Seed the 6 Exact Ledger Transactions from Account Statement
  console.log('Seeding the 6 exact ledger statement transactions...');
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

  // 12. Seed the 2 Authentic Deposit Receipts
  console.log('Seeding the 2 authentic Deposit Receipts...');
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

  // 13. Seed the 2 Authentic Shipments from Excel
  console.log('Seeding the 2 active freight shipments...');
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

  console.log('✅ MASTER DATA SYNC & SEED COMPLETED SUCCESSFULLY:');
  console.log('- 4 Official Customers Created/Updated');
  console.log('- 8 Proforma Invoices (PI-2026-0001 to PI-2026-0008, Total $555,090.30, 179,164 KG)');
  console.log('  * 2 Paid ($154,082.80): PI-2026-0001, PI-2026-0002');
  console.log('  * 6 Unpaid ($401,007.50): PI-2026-0003 through PI-2026-0008');
  console.log('- 2 Authentic Receipts (RCP-2026-0001 & RCP-2026-0002, Net $153,269.61, SWIFT Fees $813.19)');
  console.log('- 6 Ledger Transactions with dynamic running balances progressing to Ending Balance $24,259.61');
  console.log('- 2 Active Shipments (SHP-9001 -> PI-2026-0001, SHP-9002 -> PI-2026-0003)');
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
