import pino from 'pino';

import type { AuthenticatedUser } from '../../auth/types';
import { loadConfig } from '../../config';
import { OdooCapabilityRegistry } from './odoo.capabilities';
import type { JobQueue } from '../../jobs/queue';
import type { OdooCacheStore } from './odoo.cache';
import { OdooClient, type OdooFetch } from './odoo.client';
import type { OdooRuntimeConfig } from './odoo.config';
import { OdooService } from './odoo.service';

export const silentLogger = pino({ level: 'silent' });

export function odooRuntime(overrides: Partial<OdooRuntimeConfig> = {}): OdooRuntimeConfig {
  return {
    enabled: true,
    ready: true,
    baseUrl: 'https://odoo.example.com',
    database: 'company',
    apiKey: 'secret-api-key',
    timeoutMs: 250,
    maxRetries: 2,
    retryBaseMs: 0,
    userAgent: 'hackathon-starter-kit-test',
    maxPageSize: 100,
    batchSize: 2,
    ...overrides,
  };
}

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function createTestClient(fetchImpl: OdooFetch, runtime?: OdooRuntimeConfig): OdooClient {
  return new OdooClient({
    config: runtime ?? odooRuntime(),
    logger: silentLogger,
    fetchImpl,
    sleep: async () => undefined,
  });
}

export function createTestService(options: {
  fetchImpl?: OdooFetch;
  runtime?: OdooRuntimeConfig;
  capabilities?: OdooCapabilityRegistry;
  cache?: OdooCacheStore;
    jobs?: JobQueue;
    audit?: import('../../audit/audit.service').AuditService | null;
} = {}): OdooService {
  const runtime = options.runtime ?? odooRuntime();
  return new OdooService({
    config: loadConfig({ NODE_ENV: 'test' }),
    logger: silentLogger,
    runtime,
    capabilities: options.capabilities,
    cache: options.cache,
    fetchImpl: options.fetchImpl,
    sleep: async () => undefined,
    jobs: options.jobs,
    audit: options.audit,
  });
}

export function actor(permissions: string[], roles: string[] = ['staff']): AuthenticatedUser {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'staff@example.com',
    displayName: 'Staff',
    status: 'active',
    role: roles[0] ?? 'staff',
    roles,
    permissions,
  };
}
