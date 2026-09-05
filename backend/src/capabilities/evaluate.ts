import type { CapabilityDefinition, CapabilityEnablementConfig } from './types';
import { DEFAULT_ARCHITECTURE_MODE } from './types';

const PROVIDER_ADAPTERS: Record<string, (config: CapabilityEnablementConfig) => boolean> = {
  'adapter.ai.gemini': (config) => config.ai?.provider === 'gemini',
  'adapter.ai.mock': (config) => config.ai?.provider === 'mock',
  'adapter.email.smtp': (config) => config.email?.provider === 'smtp',
  'adapter.email.resend': (config) => config.email?.provider === 'resend',
  'adapter.email.brevo': (config) => config.email?.provider === 'brevo',
  'adapter.email.mock': (config) => config.email?.provider === 'mock',
  'adapter.sms.http': (config) => config.sms?.provider === 'http',
  'adapter.sms.mock': (config) => config.sms?.provider === 'mock',
  'adapter.storage.local': (config) => (config.storage?.provider ?? 'local') === 'local',
  'adapter.storage.postgres': (config) => config.storage?.provider === 'postgres',
  'adapter.storage.s3': (config) => config.storage?.provider === 's3',
  'adapter.otp.mock': (config) => (config.otp?.provider ?? 'mock') === 'mock',
  'adapter.odoo.json2': (config) => config.features?.odoo === true,
  'adapter.rag.vector.memory': (config) => (config.rag?.vectorStore ?? 'memory') === 'memory',
  'adapter.rag.vector.postgres': (config) => config.rag?.vectorStore === 'postgres',
  'adapter.rag.embedding.lexical': (config) => (config.ai?.provider ?? 'gemini') === 'mock',
  'adapter.rag.embedding.ai': (config) => config.ai?.provider === 'gemini',
  'adapter.search.postgres': (config) => (config.search?.provider ?? 'postgres') === 'postgres',
  'adapter.search.memory': (config) => config.search?.provider === 'memory',
  'adapter.analytics.postgres': (config) => (config.analytics?.provider ?? 'postgres') === 'postgres',
  'adapter.analytics.memory': (config) => config.analytics?.provider === 'memory',
};

/**
 * Whether this capability is turned on in config.
 * Does not resolve dependency graphs, construct services, or fail boot.
 * Use `resolveCapabilities` to validate an explicit selection.
 */
export function isCapabilityEnabled(
  capability: CapabilityDefinition,
  config?: CapabilityEnablementConfig,
): boolean {
  if (capability.kind === 'architecture-mode') {
    return capability.name === DEFAULT_ARCHITECTURE_MODE;
  }

  if (capability.kind === 'deployment-mode') {
    return capability.defaultEnabled !== false;
  }

  if (!config) {
    return capability.defaultEnabled !== false;
  }

  if (capability.featureFlag) {
    return config.features?.[capability.featureFlag] === true;
  }

  if (capability.kind === 'adapter') {
    const match = PROVIDER_ADAPTERS[capability.name];
    if (match) {
      return match(config);
    }
    return capability.defaultEnabled === true;
  }

  if (capability.name === 'infrastructure.postgres') {
    return Boolean(config.databaseUrl);
  }

  if (capability.name === 'infrastructure.redis') {
    return Boolean(config.redisUrl);
  }

  if (capability.name === 'demo-mode') {
    return config.demoMode === true;
  }

  return capability.defaultEnabled !== false;
}
