import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');

const REQUIRED_PATTERNS = [
  '.env',
  '.env.*',
  '!.env.example',
  '!.env.test.example',
  '!.env.demo.example',
  'node_modules/',
  'dist/',
  'build/',
  'coverage/',
  '*.log',
  'logs/',
  'tmp/',
  'temp/',
  'uploads/',
  'generated/',
  '.vscode/',
  '.idea/',
  '.cursor/',
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '.eslintcache',
  '*.pem',
  '*.key',
  '*.crt',
  '*.sqlite',
  '*.sqlite3',
  'docker-data/',
  '/backend/storage/',
  '/storage/',
  '/backend/job-queue/',
  '/job-queue/',
  '.vite/',
  'dump.rdb',
  '*.aof',
] as const;

const BLOCKED_TRACKED =
  /\.(?:pem|key|crt|p12|pfx|sqlite|sqlite3|rdb|aof)$|(?:^|\/)\.env$|(?:^|\/)credentials\.json$|(?:^|\/)docker-data\/|(?:^|\/)\.cursor\//i;

function readGitignore(): string {
  return fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
}

function ignoreLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function isIgnored(relativePath: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', relativePath], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch (error) {
    const err = error as { status?: number };
    if (err.status === 1) {
      return false;
    }
    throw error;
  }
}

function gitLines(args: string[]): string[] {
  const output = execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return output
    .split('\0')
    .map((line) => line.trim().replaceAll('\\', '/'))
    .filter((line) => line.length > 0);
}

function hasGitHead(): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function isTracked(relativePath: string): boolean {
  return gitLines(['ls-files', '-z', '--', relativePath]).includes(
    relativePath.replaceAll('\\', '/'),
  );
}

describe('.gitignore hygiene', () => {
  const gitignore = readGitignore();
  const lines = ignoreLines(gitignore);

  it('declares required ignore patterns as whole lines', () => {
    const missing = REQUIRED_PATTERNS.filter((pattern) => !lines.includes(pattern));
    expect(missing).toEqual([]);
  });

  it('does not hide storage source, migrations, or env templates', () => {
    expect(lines).not.toContain('storage/');
    expect(isIgnored('backend/src/integrations/storage/storage.service.ts')).toBe(false);
    expect(isIgnored('database/prisma/migrations/20260828120000_init/migration.sql')).toBe(false);
    expect(isIgnored('docs/configuration.md')).toBe(false);
    expect(isIgnored('docs/prerequisites.md')).toBe(false);
    expect(isIgnored('.env.example')).toBe(false);
    expect(isIgnored('.env.test.example')).toBe(false);
    expect(isIgnored('.env.demo.example')).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, '.env.demo.example'))).toBe(true);
    if (hasGitHead()) {
      expect(isTracked('.env.example')).toBe(true);
      expect(isTracked('.env.test.example')).toBe(true);
      expect(isTracked('package-lock.json')).toBe(true);
      expect(isTracked('yarn.lock')).toBe(false);
      expect(isTracked('pnpm-lock.yaml')).toBe(false);
    } else {
      expect(fs.existsSync(path.join(repoRoot, '.env.example'))).toBe(true);
      expect(fs.existsSync(path.join(repoRoot, '.env.test.example'))).toBe(true);
      expect(fs.existsSync(path.join(repoRoot, 'package-lock.json'))).toBe(true);
      expect(fs.existsSync(path.join(repoRoot, 'yarn.lock'))).toBe(false);
      expect(fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))).toBe(false);
    }
  });

  it('ignores local env, Docker data, uploads, and object storage roots', () => {
    expect(isIgnored('.env')).toBe(true);
    expect(isIgnored('.env.test')).toBe(true);
    expect(isIgnored('.env.demo')).toBe(true);
    expect(isIgnored('.env.local')).toBe(true);
    expect(isIgnored('docker-data/postgres/pg_wal/x')).toBe(true);
    expect(isIgnored('docker-data/redis/dump.rdb')).toBe(true);
    expect(isIgnored('dump.rdb')).toBe(true);
    expect(isIgnored('appendonly.aof')).toBe(true);
    expect(isIgnored('certs/server.key')).toBe(true);
    expect(isIgnored('frontend/.vite/deps/package.json')).toBe(true);
    expect(isIgnored('backend/storage/object.bin')).toBe(true);
    expect(isIgnored('storage/object.bin')).toBe(true);
    expect(isIgnored('backend/job-queue/job.json')).toBe(true);
    expect(isIgnored('uploads/file.bin')).toBe(true);
    expect(isIgnored('coverage/lcov.info')).toBe(true);
    expect(isIgnored('frontend/dist/index.html')).toBe(true);
    expect(isIgnored('node_modules/left-pad/index.js')).toBe(true);
    expect(isIgnored('secrets/prod.pem')).toBe(true);
    expect(isIgnored('.cursor/rules/storage-policy.mdc')).toBe(true);
    expect(isIgnored('.cursor/rules/hackathon-starter-kit.mdc')).toBe(true);
    expect(isIgnored('desktop.ini')).toBe(true);
    expect(isIgnored('.eslintcache')).toBe(true);
    expect(isIgnored('AGENTS.md')).toBe(false);
  });

  it('does not track env files, key material, or Docker data', () => {
    const tracked = gitLines(['ls-files', '-z']);
    expect(tracked.filter((file) => BLOCKED_TRACKED.test(file))).toEqual([]);
  });
});
