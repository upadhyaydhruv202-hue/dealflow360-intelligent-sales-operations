import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

const repoRoot = path.resolve(__dirname, '../..');
const envTestPath = path.join(repoRoot, '.env.test');
const envPath = path.join(repoRoot, '.env');

ensureProblemModuleBuilt();

if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath, override: true });
} else if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = '/hackathon_test';
    process.env.DATABASE_URL = url.toString();
  }
}

function ensureProblemModuleBuilt(): void {
  const problemDir = path.join(repoRoot, 'modules/problem');
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], {
    cwd: problemDir,
    stdio: 'pipe',
  });
}
