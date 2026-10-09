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
        'bank_details:view_masked', 'audit:view'
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

  // 4. Primary Bank Account (AFGHAN UNITED BANK)
  let bankAccount = await prisma.bankAccount.findFirst();
  if (!bankAccount) {
    bankAccount = await prisma.bankAccount.create({
      data: {
        companyProfileId: companyProfile.id,
        bankName: 'AFGHAN UNITED BANK',
        beneficiaryName: 'SKY ARIANA LTD',
        accountNumberEncrypted: '101502USD2940472',
        accountNumberMasked: '101502******0472',
        swiftCode: 'AFGUAFKAXXX',
        correspondentBank: 'DA AFGHANISTAN BANK',
        correspondentSwift: 'AFGBAFKA',
        currency: 'USD',
        isPrimary: true
      }
    });
  }

  // 5. Primary Financial USD Account
  let financialAccount = await prisma.financialAccount.findFirst({ where: { currency: 'USD' } });
  if (!financialAccount) {
    financialAccount = await prisma.financialAccount.create({
      data: {
        name: 'Afghan United Bank - USD Operating',
        accountNumber: '101502USD2940472',
        currency: 'USD',
        openingBalance: 0,
        currentBalance: 0
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
