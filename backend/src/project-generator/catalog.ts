import { FEATURE_REGISTRY, isFeatureName, type FeatureName } from '../features';
import { ValidationError } from '../errors';

export const ALLOWED_PROBLEM_PACKAGES = [
  'express',
  'zod',
  '@types/express',
  '@types/node',
  '@vitest/coverage-v8',
  'typescript',
  'vitest',
] as const;

export const FORBIDDEN_PACKAGES = [
  'kafka',
  'kafkajs',
  'elasticsearch',
  '@elastic/elasticsearch',
  'clickhouse',
  '@clickhouse/client',
  'kubernetes',
  '@kubernetes/client-node',
  'mongoose',
  'typeorm',
  'graphql',
  'apollo-server',
] as const;

export const FORBIDDEN_PROVIDER_PATH_FRAGMENTS = [
  'backend/src/integrations/ai/providers/',
  'backend/src/integrations/email/providers/',
  'backend/src/integrations/sms/',
  'backend/src/integrations/odoo/odoo.client',
  'gemini.provider',
  'smtp.provider',
] as const;

export interface AdapterEnvBinding {
  key: string;
  value: string;
  secret: boolean;
  adapter: string;
}

const ADAPTER_ENV_BINDINGS: Record<string, readonly Omit<AdapterEnvBinding, 'adapter'>[]> = {
  'adapter.ai.gemini': [
    { key: 'AI_PROVIDER', value: 'gemini', secret: false },
    { key: 'GEMINI_API_KEY', value: '', secret: true },
  ],
  'adapter.ai.mock': [{ key: 'AI_PROVIDER', value: 'mock', secret: false }],
  'adapter.email.smtp': [
    { key: 'EMAIL_PROVIDER', value: 'smtp', secret: false },
    { key: 'SMTP_HOST', value: '', secret: false },
    { key: 'SMTP_PASSWORD', value: '', secret: true },
  ],
  'adapter.email.resend': [
    { key: 'EMAIL_PROVIDER', value: 'resend', secret: false },
    { key: 'RESEND_API_KEY', value: '', secret: true },
  ],
  'adapter.email.brevo': [
    { key: 'EMAIL_PROVIDER', value: 'brevo', secret: false },
    { key: 'BREVO_API_KEY', value: '', secret: true },
  ],
  'adapter.email.mock': [{ key: 'EMAIL_PROVIDER', value: 'mock', secret: false }],
  'adapter.sms.http': [
    { key: 'SMS_PROVIDER', value: 'http', secret: false },
    { key: 'SMS_HTTP_URL', value: '', secret: false },
    { key: 'SMS_API_KEY', value: '', secret: true },
  ],
  'adapter.sms.mock': [{ key: 'SMS_PROVIDER', value: 'mock', secret: false }],
  'adapter.storage.local': [{ key: 'STORAGE_PROVIDER', value: 'local', secret: false }],
  'adapter.storage.postgres': [{ key: 'STORAGE_PROVIDER', value: 'postgres', secret: false }],
  'adapter.storage.s3': [
    { key: 'STORAGE_PROVIDER', value: 's3', secret: false },
    { key: 'FEATURE_S3', value: 'true', secret: false },
    { key: 'AWS_ACCESS_KEY_ID', value: '', secret: true },
    { key: 'AWS_SECRET_ACCESS_KEY', value: '', secret: true },
    { key: 'AWS_S3_BUCKET', value: '', secret: false },
  ],
  'adapter.odoo.json2': [
    { key: 'ODOO_BASE_URL', value: '', secret: false },
    { key: 'ODOO_DATABASE', value: '', secret: false },
    { key: 'ODOO_API_KEY', value: '', secret: true },
  ],
  'adapter.rag.vector.memory': [{ key: 'RAG_VECTOR_STORE', value: 'memory', secret: false }],
  'adapter.rag.vector.postgres': [{ key: 'RAG_VECTOR_STORE', value: 'postgres', secret: false }],
  'adapter.search.postgres': [
    { key: 'SEARCH_PROVIDER', value: 'postgres', secret: false },
    { key: 'FEATURE_SEARCH', value: 'true', secret: false },
  ],
  'adapter.search.memory': [
    { key: 'SEARCH_PROVIDER', value: 'memory', secret: false },
    { key: 'FEATURE_SEARCH', value: 'true', secret: false },
  ],
  'adapter.analytics.postgres': [
    { key: 'ANALYTICS_PROVIDER', value: 'postgres', secret: false },
    { key: 'FEATURE_ANALYTICS', value: 'true', secret: false },
  ],
  'adapter.analytics.memory': [
    { key: 'ANALYTICS_PROVIDER', value: 'memory', secret: false },
    { key: 'FEATURE_ANALYTICS', value: 'true', secret: false },
  ],
};

const PROVIDER_FAMILY_PRIORITY: Record<string, readonly string[]> = {
  AI_PROVIDER: ['adapter.ai.mock', 'adapter.ai.gemini'],
  EMAIL_PROVIDER: ['adapter.email.mock', 'adapter.email.smtp', 'adapter.email.resend', 'adapter.email.brevo'],
  SMS_PROVIDER: ['adapter.sms.mock', 'adapter.sms.http'],
  STORAGE_PROVIDER: ['adapter.storage.local', 'adapter.storage.postgres', 'adapter.storage.s3'],
  RAG_VECTOR_STORE: ['adapter.rag.vector.memory', 'adapter.rag.vector.postgres'],
  SEARCH_PROVIDER: ['adapter.search.memory', 'adapter.search.postgres'],
  ANALYTICS_PROVIDER: ['adapter.analytics.memory', 'adapter.analytics.postgres'],
};

export function assertNoArbitraryPackages(packages: readonly string[] | undefined): void {
  const requested = [...new Set((packages ?? []).map((name) => name.trim()).filter(Boolean))].sort();
  if (requested.length === 0) {
    return;
  }
  const forbidden = requested.filter(
    (name) =>
      (FORBIDDEN_PACKAGES as readonly string[]).includes(name) ||
      !(ALLOWED_PROBLEM_PACKAGES as readonly string[]).includes(name),
  );
  if (forbidden.length > 0) {
    throw new ValidationError('Arbitrary package installation is not allowed', {
      packages: forbidden,
      note: 'AI can recommend packages. The generator only emits the allowlisted problem-module dependencies already used by this kit.',
    });
  }
}

export function assertNoGeneratedCommands(commands: readonly string[] | undefined): void {
  const requested = (commands ?? []).map((item) => item.trim()).filter(Boolean);
  if (requested.length > 0) {
    throw new ValidationError('Arbitrary shell commands are not allowed', {
      commands: requested,
      note: 'The generator never emits shell from AI output. Documented npm scripts come from static templates.',
    });
  }
}

export function isKnownAdapter(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ADAPTER_ENV_BINDINGS, name);
}

export function selectAdapterEnv(selectedAdapters: readonly string[]): AdapterEnvBinding[] {
  const selected = new Set(selectedAdapters);
  const chosenAdapters = new Set<string>();
  for (const family of Object.keys(PROVIDER_FAMILY_PRIORITY).sort()) {
    const winner = PROVIDER_FAMILY_PRIORITY[family].find((name) => selected.has(name));
    if (winner) {
      chosenAdapters.add(winner);
    }
  }
  for (const name of [...selected].sort()) {
    if (ADAPTER_ENV_BINDINGS[name] && ![...chosenAdapters].some((chosen) => sharesEnvFamily(chosen, name))) {
      chosenAdapters.add(name);
    }
  }

  const bindings: AdapterEnvBinding[] = [];
  for (const adapter of [...chosenAdapters].sort()) {
    for (const binding of ADAPTER_ENV_BINDINGS[adapter] ?? []) {
      bindings.push({ ...binding, adapter });
    }
  }
  return bindings;
}

function sharesEnvFamily(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }
  return Object.values(PROVIDER_FAMILY_PRIORITY).some(
    (family) => family.includes(left) && family.includes(right),
  );
}

export function featureFlagEnvVar(featureFlag: string): string | null {
  if (!isFeatureName(featureFlag)) {
    return null;
  }
  return FEATURE_REGISTRY[featureFlag as FeatureName].envVar;
}
