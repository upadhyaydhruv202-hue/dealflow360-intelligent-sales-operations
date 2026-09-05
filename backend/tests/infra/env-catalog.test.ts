import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config';
import { envSchema } from '../../src/config/schema';

const repoRoot = path.resolve(__dirname, '../../..');

const SCHEMA_KEYS = Object.keys(envSchema.shape);

const COMPOSE_AND_FRONTEND_KEYS = [
  'VITE_API_URL',
  'API_PROXY_TARGET',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'SEED_ON_START',
] as const;

const SECRET_NAMES = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'OTP_HASH_SECRET',
  'STORAGE_SIGNING_SECRET',
  'ODOO_API_KEY',
  'GEMINI_API_KEY',
  'SMTP_PASSWORD',
  'RESEND_API_KEY',
  'BREVO_API_KEY',
  'SMS_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
] as const;

const PLACEHOLDER =
  /(change-me|not-for-production|placeholder|example|dummy|your-|local-dev|test-|replace-me|todo|sample|xxxxx|abc123)/i;

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function documentedKeys(content: string): string[] {
  const keys = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/);
    if (match?.[1]) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

function assignedRecord(content: string): Record<string, string> {
  const source: Record<string, string> = {};
  for (const { key, value } of assignedValues(content)) {
    source[key] = value;
  }
  return source;
}

function assignedValues(content: string): Array<{ key: string; value: string }> {
  const rows: Array<{ key: string; value: string }> = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.length === 0) {
      continue;
    }
    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) {
      rows.push({ key: match[1], value: match[2] ?? '' });
    }
  }
  return rows;
}

describe('environment variable catalog', () => {
  const example = readRepoFile('.env.example');
  const testExample = readRepoFile('.env.test.example');
  const demoExample = readRepoFile('.env.demo.example');
  const keys = documentedKeys(example);

  it('documents every schema key in .env.example', () => {
    const missing = SCHEMA_KEYS.filter((key) => !keys.includes(key));
    expect(missing).toEqual([]);
  });

  it('only documents schema keys plus Compose/Vite extras in .env.example', () => {
    const allowed = new Set<string>([...SCHEMA_KEYS, ...COMPOSE_AND_FRONTEND_KEYS]);
    const unknown = keys.filter((key) => !allowed.has(key));
    expect(unknown).toEqual([]);
  });

  it('ships the authoritative catalog document', () => {
    expect(fs.existsSync(path.join(repoRoot, 'docs/environment.md'))).toBe(true);
    expect(readRepoFile('docs/environment.md')).toContain('VITE_API_URL');
    expect(readRepoFile('docs/README.md')).toContain('environment.md');
  });

  it('parses .env.example through envSchema and loadConfig', () => {
    const source = assignedRecord(example);
    const result = envSchema.safeParse(source);
    expect(result.success).toBe(true);
    const config = loadConfig(source);
    expect(config.nodeEnv).toBe('development');
    expect(config.databaseUrl).toContain('localhost:5433');
    expect(config.demoMode).toBe(true);
    expect(config.features.pdf).toBe(true);
  });

  it('parses .env.test.example and .env.demo.example through envSchema and loadConfig', () => {
    const testSource = assignedRecord(testExample);
    expect(envSchema.safeParse(testSource).success).toBe(true);
    const testConfig = loadConfig(testSource);
    expect(testConfig.isTest).toBe(true);
    expect(testConfig.demoMode).toBe(true);
    expect(testConfig.features.ai).toBe(false);
    expect(testConfig.auth.password.bcryptCost).toBe(4);

    const demoSource = assignedRecord(demoExample);
    expect(envSchema.safeParse(demoSource).success).toBe(true);
    const demoConfig = loadConfig(demoSource);
    expect(demoConfig.demoMode).toBe(true);
    expect(demoConfig.ai.provider).toBe('mock');
    expect(demoConfig.email.provider).toBe('mock');
    expect(demoConfig.sms.provider).toBe('mock');
    expect(demoConfig.otp.provider).toBe('mock');
    expect(demoConfig.features.odoo).toBe(false);
    expect(demoConfig.features.s3).toBe(false);
  });

  it('does not assign real secrets in example files', () => {
    for (const [label, content] of [
      ['.env.example', example],
      ['.env.test.example', testExample],
      ['.env.demo.example', demoExample],
    ] as const) {
      for (const { key, value } of assignedValues(content)) {
        if (!SECRET_NAMES.includes(key as (typeof SECRET_NAMES)[number])) {
          continue;
        }
        if (value.trim() === '') {
          continue;
        }
        expect({ file: label, key, value, ok: PLACEHOLDER.test(value) }).toMatchObject({
          file: label,
          key,
          ok: true,
        });
      }
    }
  });

  it('does not expose secrets through VITE_ variables', () => {
    const viteKeys = keys.filter((key) => key.startsWith('VITE_'));
    expect(viteKeys).toEqual(['VITE_API_URL']);

    for (const secret of SECRET_NAMES) {
      expect(secret.startsWith('VITE_')).toBe(false);
      expect(viteKeys).not.toContain(secret);
    }
  });

  it('keeps the frontend public surface to VITE_API_URL only', () => {
    const frontendSrc = path.join(repoRoot, 'frontend/src');
    const files: string[] = [];

    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(full);
        }
      }
    }

    walk(frontendSrc);

    const viteRefs = new Set<string>();
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
        if (match[1]) {
          viteRefs.add(match[1]);
        }
      }
    }

    expect([...viteRefs].sort()).toEqual(['VITE_API_URL']);
    expect(readRepoFile('frontend/src/vite-env.d.ts')).toContain('VITE_API_URL');
    expect(readRepoFile('frontend/Dockerfile')).toMatch(/ARG VITE_API_URL=/);
    expect(readRepoFile('frontend/Dockerfile')).not.toMatch(
      /ARG VITE_(?:JWT|SECRET|API_KEY|PASSWORD)/,
    );
  });
});
