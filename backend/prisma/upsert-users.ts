import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- UPSERTING REQUESTED SYSTEM USERS ---');

  const adminRole = await prisma.role.findUnique({
    where: { name: 'ADMIN' }
  });

  if (!adminRole) {
    throw new Error('ADMIN role does not exist in the database! Run seed first.');
  }

  const usersToAdd = [
    {
      email: 'ahsanullah@aqcompanies.com',
      firstName: 'Ahsanullah',
      lastName: 'Qureshi',
      plainPassword: 'Qur78Ahs@@',
      role: 'ADMIN'
    },
    {
      email: 'danish@aqcompanies.com',
      firstName: 'Danish',
      lastName: 'Qureshi',
      plainPassword: 'Danish123@789',
      role: 'ADMIN'
    }
  ];

  for (const u of usersToAdd) {
    const passwordHash = await bcrypt.hash(u.plainPassword, 10);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash,
        isActive: true
      },
      create: {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: true
      }
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: adminRole.id
        }
      },
      update: {},
      create: {
        userId: user.id,
        roleId: adminRole.id
      }
    });

    console.log(`Successfully upserted user: ${u.email} (${u.firstName} ${u.lastName}) with role ${u.role}`);
  }

  const allUsers = await prisma.user.findMany({
    include: {
      userRoles: {
        include: { role: true }
      }
    }
  });

  console.log('\n--- CURRENT DATABASE USERS ---');
  for (const u of allUsers) {
    const roles = u.userRoles.map(r => r.role.name).join(', ');
    console.log(`- ${u.email} | ${u.firstName} ${u.lastName} | Roles: [${roles}] | Active: ${u.isActive}`);
  }
}

main()
  .catch((e) => {
    console.error('Error upserting users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
