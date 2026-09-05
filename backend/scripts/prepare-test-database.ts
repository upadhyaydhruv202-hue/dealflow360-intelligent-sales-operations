import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

const require = createRequire(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const envPath = path.join(repoRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function getRequiredDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is required. Copy .env.example to .env or export the variable.');
  }

  return url;
}

const sourceUrl = getRequiredDatabaseUrl();

const TEST_DATABASE_NAME = 'hackathon_test';

function toTestDatabaseUrl(connectionString: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${TEST_DATABASE_NAME}`;
  return url.toString();
}

async function ensureDatabase(): Promise<string> {
  const testUrl = toTestDatabaseUrl(sourceUrl);
  const admin = new PrismaClient({
    datasources: { db: { url: sourceUrl } },
  });

  try {
    const rows = await admin.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${TEST_DATABASE_NAME}) AS exists
    `;

    if (!rows[0]?.exists) {
      await admin.$executeRawUnsafe(`CREATE DATABASE ${TEST_DATABASE_NAME}`);
      console.log(`Created database ${TEST_DATABASE_NAME}`);
    }
  } finally {
    await admin.$disconnect();
  }

  return testUrl;
}

function migrate(testUrl: string): Promise<void> {
  const schemaPath = path.join(repoRoot, 'database', 'prisma', 'schema.prisma');
  const prismaCli = require.resolve('prisma/build/index.js');

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schemaPath], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: testUrl },
      cwd: path.join(repoRoot, 'backend'),
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`prisma migrate deploy exited with code ${code ?? 1}`));
    });
  });
}

ensureDatabase()
  .then(async (testUrl) => {
    await migrate(testUrl);
    console.log(`Test database ${TEST_DATABASE_NAME} is ready.`);
  })
  .catch((error: unknown) => {
    console.error('Failed to prepare the test database');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  });
