import { isFeatureEnabled } from '../../features';
import type { AppConfig } from '../../types/config';

export const ODOO_JSON2_PREFIX = '/json/2';
export const ODOO_VERSION_PATH = '/web/version';
export const ODOO_PROVIDER = 'odoo';

export const ODOO_DEFAULTS = {
  timeoutMs: 15_000,
  maxRetries: 2,
  retryBaseMs: 200,
  maxPageSize: 100,
  defaultPageSize: 20,
  batchSize: 50,
  userAgent: 'hackathon-starter-kit/0.1.0',
} as const;

export const ODOO_IDEMPOTENT_METHODS = new Set([
  'search',
  'search_read',
  'search_count',
  'read',
  'exists',
  'name_search',
  'name_get',
  'fields_get',
  'default_get',
  'context_get',
]);

export interface OdooRuntimeConfig {
  enabled: boolean;
  ready: boolean;
  baseUrl?: string;
  database?: string;
  apiKey?: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseMs: number;
  userAgent: string;
  maxPageSize: number;
  batchSize: number;
}

export function isOdooEnabled(config: Pick<AppConfig, 'odoo' | 'features'>): boolean {
  return isFeatureEnabled(config, 'odoo');
}

export function resolveOdooRuntimeConfig(config: AppConfig): OdooRuntimeConfig {
  const enabled = isOdooEnabled(config);
  const baseUrl = trimTrailingSlash(config.odoo.baseUrl);
  const database = config.odoo.database;
  const apiKey = config.odoo.apiKey;
  const ready = Boolean(enabled && baseUrl && database && apiKey);

  return {
    enabled,
    ready,
    baseUrl,
    database,
    apiKey,
    timeoutMs: config.odoo.timeoutMs,
    maxRetries: config.odoo.maxRetries,
    retryBaseMs: config.odoo.retryBaseMs,
    userAgent: ODOO_DEFAULTS.userAgent,
    maxPageSize: ODOO_DEFAULTS.maxPageSize,
    batchSize: ODOO_DEFAULTS.batchSize,
  };
}

export function isIdempotentOdooMethod(method: string): boolean {
  return ODOO_IDEMPOTENT_METHODS.has(method);
}

export function buildOdooJson2Url(baseUrl: string, model: string, method: string): string {
  return `${trimTrailingSlash(baseUrl)}${ODOO_JSON2_PREFIX}/${encodeURIComponent(model)}/${encodeURIComponent(method)}`;
}

export function buildOdooVersionUrl(baseUrl: string): string {
  return `${trimTrailingSlash(baseUrl)}${ODOO_VERSION_PATH}`;
}

function trimTrailingSlash(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.replace(/\/+$/, '');
}
