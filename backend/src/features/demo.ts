import type { AppConfig } from '../types/config';
import { isDemoMode } from './evaluate';

/** Seeded local/demo accounts from `database/prisma/seed.ts`. Not production credentials. */
export const SEEDED_DEMO_ACCOUNT_EMAILS = [
  'demo.admin@example.com',
  'demo.manager@example.com',
  'demo.staff@example.com',
  'demo.user@example.com',
] as const;

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return undefined;
}

export function resolveDemoMode(input: { DEMO_MODE?: unknown; NODE_ENV?: string }): boolean {
  const parsed = parseOptionalBoolean(input.DEMO_MODE);
  if (parsed !== undefined) {
    return parsed;
  }

  return input.NODE_ENV !== 'production';
}

export function shouldMockExternalIntegrations(
  config: Pick<AppConfig, 'demoMode' | 'isTest'>,
): boolean {
  return isDemoMode(config) || config.isTest;
}

export function shouldSeedDemoData(config: Pick<AppConfig, 'demoMode'>): boolean {
  return isDemoMode(config);
}

export function shouldSeedDemoDataFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveDemoMode({ DEMO_MODE: env.DEMO_MODE, NODE_ENV: env.NODE_ENV });
}

export function normalizeLoginEmail(email: unknown): string | undefined {
  if (typeof email !== 'string') {
    return undefined;
  }

  const normalized = email.trim().toLowerCase();
  return normalized === '' ? undefined : normalized;
}

export function isSeededDemoAccountEmail(email: unknown): boolean {
  const normalized = normalizeLoginEmail(email);
  if (!normalized) {
    return false;
  }

  return (SEEDED_DEMO_ACCOUNT_EMAILS as readonly string[]).includes(normalized);
}

/**
 * DEMO_MODE only: skip login brute-force throttling for known seeded demo emails.
 * Password checks, JWT issuance, and RBAC stay unchanged. Arbitrary accounts stay limited.
 */
export function shouldRelaxSeededDemoLoginRateLimit(
  config: Pick<AppConfig, 'demoMode'>,
  email: unknown,
): boolean {
  return isDemoMode(config) && isSeededDemoAccountEmail(email);
}
