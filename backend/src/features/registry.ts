import { FEATURE_NAMES, emptyFeatureMap, isFeatureName } from '@hackathon/api-contract';
import type { FeatureMap, FeatureName } from '@hackathon/api-contract';

export { FEATURE_NAMES, isFeatureName };
export type { FeatureMap, FeatureName };

export interface FeatureDefinition {
  name: FeatureName;
  envVar: string;
  aliases: string[];
  default: boolean;
  dependencies: FeatureName[];
  purpose: string;
}

export const FEATURE_REGISTRY: Record<FeatureName, FeatureDefinition> = {
  ai: {
    name: 'ai',
    envVar: 'FEATURE_AI',
    aliases: ['AI_ENABLED'],
    default: false,
    dependencies: [],
    purpose: 'LLM toolkit, document intelligence, and mock or Gemini providers',
  },
  odoo: {
    name: 'odoo',
    envVar: 'FEATURE_ODOO',
    aliases: ['ODOO_ENABLED'],
    default: false,
    dependencies: [],
    purpose: 'Odoo 19 JSON-2 client, capabilities, and model adapters',
  },
  automation: {
    name: 'automation',
    envVar: 'FEATURE_AUTOMATION',
    aliases: [],
    default: false,
    dependencies: [],
    purpose: 'Trigger-condition-action workflows, event matching, and automation HTTP API',
  },
  notifications: {
    name: 'notifications',
    envVar: 'FEATURE_NOTIFICATIONS',
    aliases: [],
    default: false,
    dependencies: [],
    purpose: 'Extra notification side effects (for example document-analysis alerts). Inbox HTTP stays available when the database is configured',
  },
  otp: {
    name: 'otp',
    envVar: 'FEATURE_OTP',
    aliases: [],
    default: false,
    dependencies: [],
    purpose: 'Hashed one-time passcodes, OTP HTTP, and password reset',
  },
  sms: {
    name: 'sms',
    envVar: 'FEATURE_SMS',
    aliases: ['SMS_ENABLED'],
    default: false,
    dependencies: [],
    purpose: 'Transactional SMS channel and SmsService',
  },
  s3: {
    name: 's3',
    envVar: 'FEATURE_S3',
    aliases: ['STORAGE_PROVIDER=s3'],
    default: false,
    dependencies: [],
    purpose: 'Require AWS S3 secrets; STORAGE_PROVIDER=s3 also enables this flag',
  },
  rag: {
    name: 'rag',
    envVar: 'FEATURE_RAG',
    aliases: [],
    default: false,
    dependencies: ['ai'],
    purpose: 'Optional semantic document search. Index, retrieve, and answer with source citations. Off by default',
  },
  copilot: {
    name: 'copilot',
    envVar: 'FEATURE_COPILOT',
    aliases: [],
    default: false,
    dependencies: ['ai'],
    purpose: 'Controlled assistant HTTP API and chat UI. Still needs a ready AI provider at runtime',
  },
  intents: {
    name: 'intents',
    envVar: 'FEATURE_INTENTS',
    aliases: [],
    default: false,
    dependencies: ['ai'],
    purpose: 'Natural-language business actions: extract a registered intent, validate, authorize, confirm, then run a handler',
  },
  problemIntelligence: {
    name: 'problemIntelligence',
    envVar: 'FEATURE_PROBLEM_INTELLIGENCE',
    aliases: [],
    default: false,
    dependencies: ['ai'],
    purpose:
      'Analyze a hackathon problem statement into a structured spec and classify requirements against the capability catalog',
  },
  capabilityRecommendations: {
    name: 'capabilityRecommendations',
    envVar: 'FEATURE_CAPABILITY_RECOMMENDATIONS',
    aliases: [],
    default: false,
    dependencies: [],
    purpose:
      'Deterministic advisory mapping from structured problem analysis to capabilities, profiles, adapters, and modes. Does not enable FEATURE_* or construct services',
  },
  projectPlanning: {
    name: 'projectPlanning',
    envVar: 'FEATURE_PROJECT_PLANNING',
    aliases: [],
    default: false,
    dependencies: [],
    purpose:
      'Project planning UI and APIs: problem statement, capability selection, and a validated Project Configuration. Does not generate code or enable FEATURE_*',
  },
  projectGenerator: {
    name: 'projectGenerator',
    envVar: 'FEATURE_PROJECT_GENERATOR',
    aliases: [],
    default: false,
    dependencies: [],
    purpose:
      'Deterministic project generator: approved Project Configuration → isolated overlay. Does not modify kit source, provider internals, or install AI-suggested packages',
  },
  anomalyDetection: {
    name: 'anomalyDetection',
    envVar: 'FEATURE_ANOMALY_DETECTION',
    aliases: [],
    default: false,
    dependencies: [],
    purpose:
      'Optional anomaly insight engine. Deterministic detection plus optional AI explanation. Detection does not require AI. Off by default',
  },
  realtime: {
    name: 'realtime',
    envVar: 'FEATURE_REALTIME',
    aliases: [],
    default: false,
    dependencies: [],
    purpose:
      'Optional Server-Sent Events for allowlisted job, notification, dashboard, automation, and document status. Off by default. REST polling stays available',
  },
  search: {
    name: 'search',
    envVar: 'FEATURE_SEARCH',
    aliases: [],
    default: false,
    dependencies: [],
    purpose:
      'Provider-agnostic keyword, filter, sort, pagination, and PostgreSQL full-text search. Elasticsearch is not included; a future adapter can implement SearchProvider',
  },
  analytics: {
    name: 'analytics',
    envVar: 'FEATURE_ANALYTICS',
    aliases: [],
    default: false,
    dependencies: [],
    purpose:
      'Reusable KPI definitions, aggregations, time-series, dashboards, filters, and exports. Problem-specific metrics stay in modules/problem. Not a warehouse',
  },
  pdf: {
    name: 'pdf',
    envVar: 'FEATURE_PDF',
    aliases: [],
    default: true,
    dependencies: [],
    purpose: 'PDF generate and report HTTP APIs. Defaults on so existing apps keep those routes; set FEATURE_PDF=false to disable. Jobs and automation can still render PDFs',
  },
};

export const DISABLED_FEATURES: FeatureMap = emptyFeatureMap();

export function listFeatureRegistry(): FeatureDefinition[] {
  return FEATURE_NAMES.map((name) => FEATURE_REGISTRY[name]);
}
