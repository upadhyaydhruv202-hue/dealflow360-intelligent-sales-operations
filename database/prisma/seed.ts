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
] as const;

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  const { roles } = await seedRbacCatalog(prisma);
  await seedDealflowCatalog(prisma);

  if (!shouldSeedDemoDataFromEnv()) {
    console.log('Seeded RBAC catalog. Skipped demo users because DEMO_MODE is off.');
    return;
  }

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
      title: 'Welcome to the starter kit',
      body: 'Your admin demo account is ready. This is example data, not a real credential notice.',
    },
    {
      userId: users[1].id,
      type: 'info',
      title: 'Team digest available',
      body: 'Example notification for the manager demo user.',
    },
    {
      userId: users[2].id,
      type: 'info',
      title: 'Shift briefing',
      body: 'Example notification for the staff demo user.',
    },
    {
      userId: users[3].id,
      type: 'warning',
      title: 'Complete your profile',
      body: 'Example unread notification for the standard demo user.',
    },
    {
      userId: users[3].id,
      type: 'info',
      title: 'Welcome aboard',
      body: 'Example already-read notification.',
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
