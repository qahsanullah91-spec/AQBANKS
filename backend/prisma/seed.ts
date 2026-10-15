import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING DEVELOPMENT ENVIRONMENT ---');
  console.log('NOTE: Development seed data is isolated and clearly identified.');

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
  const passwordHash = await bcrypt.hash('AQCompanies@2026', 10);
  const usersToSeed = [
    { email: 'admin@aqcompanies.com', firstName: 'System', lastName: 'Administrator', role: 'ADMIN' },
    { email: 'finance@aqcompanies.com', firstName: 'Ahmad', lastName: 'Finance', role: 'FINANCE_MANAGER' },
    { email: 'logistics@aqcompanies.com', firstName: 'Tariq', lastName: 'Logistics', role: 'LOGISTICS_COORDINATOR' },
    { email: 'auditor@aqcompanies.com', firstName: 'Sarah', lastName: 'Auditor', role: 'AUDITOR' },
    { email: 'viewer@aqcompanies.com', firstName: 'Guest', lastName: 'Viewer', role: 'VIEWER' }
  ];

  for (const u of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { firstName: u.firstName, lastName: u.lastName },
      create: {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName
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
    correspondentBank: '(DAB) DA AFGHANISTAN BANK',
    correspondentSwift: 'AFGBAFKA',
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
    swiftField59A: 'Beneficiary account in field 59A; AFGUAFKAXXX in field 57A.',
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
        openingBalance: 0,
        currentBalance: 0
      }
    });
  } else {
    await prisma.financialAccount.update({
      where: { id: financialAccount.id },
      data: {
        name: 'Afghan United Bank - USD Operating (AWDCCA)',
        accountNumber: '101502USD2940472'
      }
    });
  }

  console.log('✅ Seed completed successfully.');
  console.log('Default credentials for all seed accounts: AQCompanies@2026');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
