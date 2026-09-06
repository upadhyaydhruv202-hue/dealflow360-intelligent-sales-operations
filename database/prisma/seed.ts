import fs from 'node:fs';
import path from 'node:path';

import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import { ROLES } from '../../backend/src/rbac/catalog';
import { seedRbacCatalog } from '../../backend/src/rbac/seed-catalog';
import { shouldSeedDemoDataFromEnv } from '../../backend/src/features/demo';
import { seedDealflowCatalog } from './seed-dealflow';

const repoRoot = path.resolve(__dirname, '../..');
const envPath = path.join(repoRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const DEMO_PASSWORD = 'demo-password';

const DEMO_USERS = [
  {
    email: 'demo.admin@example.com',
    displayName: 'Demo Admin',
    role: ROLES.ADMIN,
  },
  {
    email: 'demo.manager@example.com',
    displayName: 'Demo Manager',
    role: ROLES.MANAGER,
  },
  {
    email: 'demo.staff@example.com',
    displayName: 'Demo Staff',
    role: ROLES.STAFF,
  },
  {
    email: 'demo.user@example.com',
    displayName: 'Demo User',
    role: ROLES.USER,
  },
  {
    email: 'demo.finance@example.com',
    displayName: 'Demo Finance',
    role: 'finance',
  },
] as const;

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  const { roles } = await seedRbacCatalog(prisma);

  if (!shouldSeedDemoDataFromEnv()) {
    await seedDealflowCatalog(prisma, { includePresentationData: false });
    console.log(
      'Seeded RBAC catalog and DealFlow configuration. Skipped demo users, sample customers, inventory, and sample quotes because DEMO_MODE is off.',
    );
    return;
  }

  await prisma.user.deleteMany({ where: { email: 'demo.operations@example.com' } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users = [];
  for (const demoUser of DEMO_USERS) {
    const role = roles.get(demoUser.role);
    if (!role) {
      throw new Error(`Missing seeded role: ${demoUser.role}`);
    }

    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {
        displayName: demoUser.displayName,
        passwordHash,
        status: 'active',
      },
      create: {
        email: demoUser.email,
        displayName: demoUser.displayName,
        passwordHash,
        status: 'active',
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
      },
    });

    users.push({ ...demoUser, id: user.id });
  }

  const notifications: Prisma.NotificationCreateManyInput[] = [
    {
      userId: users[0].id,
      type: 'success',
      title: 'Pipeline loaded',
      body: 'Discount policies, approval chains, and the current quarter of quotations are ready for review.',
    },
    {
      userId: users[1].id,
      type: 'warning',
      title: 'Approvals waiting',
      body: 'Infosys and HDFC Bank quotations need a manager or finance step before they can be sent.',
    },
    {
      userId: users[2].id,
      type: 'info',
      title: 'Fulfillment queue',
      body: 'Flipkart, Maersk, and DP World Mundra have allocated hardware. Check reserved stock in Mumbai and Jebel Ali.',
    },
    {
      userId: users[3].id,
      type: 'warning',
      title: 'Northwind draft is open',
      body: 'DF-00001 is still a draft. Open the customer portal to review line items before you submit a change request.',
    },
    {
      userId: users[3].id,
      type: 'info',
      title: 'Invoice received',
      body: 'Shoprite Holdings completed DF-00036. The Core Gateway and Control Suite charges are on the account.',
      readAt: new Date(),
    },
  ];

  for (const notification of notifications) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: notification.userId,
        title: notification.title,
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.notification.create({ data: notification });
    }
  }

  const staff = users.find((item) => item.email === 'demo.staff@example.com');
  await seedDealflowCatalog(prisma, { includePresentationBook: true, ownerId: staff?.id });

  console.log('Seeded demo roles, permissions, users, notifications, and DealFlow360 catalog.');
  console.log('Demo login (local/demo only, not a real credential):');
  for (const user of DEMO_USERS) {
    console.log(`  ${user.email} / ${DEMO_PASSWORD} (${user.role})`);
  }
}

seed()
  .catch((error: unknown) => {
    console.error('Database seed failed');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
