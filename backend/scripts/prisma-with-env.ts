import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import dotenv from 'dotenv';

const require = createRequire(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const envPath = path.join(repoRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Copy .env.example to .env or export the variable.');
  process.exit(1);
}

const schemaPath = path.join(repoRoot, 'database', 'prisma', 'schema.prisma');
const prismaCli = require.resolve('prisma/build/index.js');

const child = spawn(process.execPath, [prismaCli, ...process.argv.slice(2), '--schema', schemaPath], {
  stdio: 'inherit',
  env: process.env,
  cwd: path.join(repoRoot, 'backend'),
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
