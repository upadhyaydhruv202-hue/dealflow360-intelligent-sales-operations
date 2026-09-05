import { defineProfile } from './define';
import type { ProjectProfile } from './types';

export const PROFILE_NAMES = {
  basicWeb: 'profile.basic-web',
  aiApplication: 'profile.ai-application',
  odooApplication: 'profile.odoo-application',
  enterpriseApplication: 'profile.enterprise-application',
  documentIntelligence: 'profile.document-intelligence',
  realTime: 'profile.real-time',
  dataHeavy: 'profile.data-heavy',
  automation: 'profile.automation',
  analytics: 'profile.analytics',
  integrationHeavy: 'profile.integration-heavy',
  offlineResilient: 'profile.offline-resilient',
  cloudNative: 'profile.cloud-native',
} as const;

const BASIC_WEB_CAPABILITIES = [
  'foundation',
  'validation',
  'security',
  'database',
  'auth',
  'rbac',
  'observability',
  'testing',
  'feature-flags',
  'problem.module',
  'frontend.ui',
  'frontend.layout',
  'frontend.forms',
  'frontend.tables',
  'frontend.auth',
  'frontend.theme',
  'infrastructure.postgres',
  'infrastructure.github-actions',
] as const;

export const PLATFORM_PROFILES: readonly ProjectProfile[] = [
  defineProfile({
    name: PROFILE_NAMES.basicWeb,
    title: 'Basic Web',
    maturity: 'stable',
    summary:
      'Auth, RBAC, Postgres, UI kit, and CI. The default starting set for a modular-monolith web app.',
    capabilities: [...BASIC_WEB_CAPABILITIES],
    documentation: ['docs/profiles.md', 'docs/auth.md', 'docs/ui.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.aiApplication,
    title: 'AI Application',
    maturity: 'stable',
    summary: 'Basic Web plus provider-agnostic AI toolkit, guardrails, and AI UI surfaces.',
    includes: [PROFILE_NAMES.basicWeb],
    capabilities: [
      'ai',
      'ai.guardrails',
      'ai.summarization',
      'ai.classification',
      'ai.extraction',
      'ai.recommendation',
      'frontend.ai',
    ],
    optionalCapabilities: [
      'copilot',
      'intents',
      'rag',
      'problem.intelligence',
      'capability.recommendations',
      'project.planning',
      'frontend.copilot',
      'frontend.problem-intelligence',
      'frontend.capability-recommendations',
      'frontend.project-planning',
      'project.generator',
      'frontend.project-generator',
      'adapter.ai.mock',
    ],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      capabilities: {
        ai: '^0.1.0',
        'ai.guardrails': '^0.1.0',
      },
      profiles: {
        [PROFILE_NAMES.basicWeb]: '^0.1.0',
      },
    },
    documentation: ['docs/profiles.md', 'docs/ai.md', 'docs/ai-guardrails.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.odooApplication,
    title: 'Odoo Application',
    maturity: 'stable',
    summary: 'Basic Web plus Odoo 19 JSON-2 integration. Credentials stay server-side.',
    includes: [PROFILE_NAMES.basicWeb],
    capabilities: ['odoo', 'adapter.odoo.json2'],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      capabilities: { odoo: '^0.1.0' },
      profiles: { [PROFILE_NAMES.basicWeb]: '^0.1.0' },
    },
    documentation: ['docs/profiles.md', 'docs/odoo.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.documentIntelligence,
    title: 'Document Intelligence',
    maturity: 'stable',
    summary: 'AI Application plus upload, storage, extraction, and background document jobs.',
    includes: [PROFILE_NAMES.aiApplication],
    capabilities: ['documents', 'storage', 'jobs'],
    optionalCapabilities: ['notifications', 'pdf'],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      capabilities: { documents: '^0.1.0', storage: '^0.1.0' },
      profiles: { [PROFILE_NAMES.aiApplication]: '^0.1.0' },
    },
    documentation: ['docs/profiles.md', 'docs/documents.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.automation,
    title: 'Automation',
    maturity: 'stable',
    summary:
      'Basic Web plus events, jobs, declarative workflows, scheduler, notifications, and email.',
    includes: [PROFILE_NAMES.basicWeb],
    capabilities: ['events', 'jobs', 'automation', 'scheduler', 'notifications', 'email'],
    optionalCapabilities: ['adapter.email.mock', 'webhooks'],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      capabilities: { automation: '^0.1.0', events: '^0.1.0', jobs: '^0.1.0' },
      profiles: { [PROFILE_NAMES.basicWeb]: '^0.1.0' },
    },
    documentation: ['docs/profiles.md', 'docs/automation.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.analytics,
    title: 'Analytics',
    maturity: 'stable',
    summary: 'Basic Web plus dashboard slots, charts, reusable analytics queries, reports, and PDF output. Not a warehouse.',
    includes: [PROFILE_NAMES.basicWeb],
    capabilities: [
      'analytics',
      'frontend.analytics',
      'frontend.dashboard',
      'frontend.charts',
      'reports',
      'pdf',
      'storage',
    ],
    optionalCapabilities: ['anomaly'],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      profiles: { [PROFILE_NAMES.basicWeb]: '^0.1.0' },
    },
    documentation: ['docs/profiles.md', 'docs/reports.md', 'docs/analytics.md', 'docs/ui.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.integrationHeavy,
    title: 'Integration-Heavy',
    maturity: 'stable',
    summary: 'Basic Web plus Odoo, email, SMS, storage, webhooks, and OTP adapters.',
    includes: [PROFILE_NAMES.basicWeb],
    capabilities: ['odoo', 'adapter.odoo.json2', 'email', 'sms', 'storage', 'webhooks', 'otp'],
    optionalCapabilities: [
      'adapter.storage.s3',
      'adapter.sms.mock',
      'adapter.email.mock',
      'adapter.otp.mock',
    ],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      capabilities: { odoo: '^0.1.0' },
      profiles: { [PROFILE_NAMES.basicWeb]: '^0.1.0' },
    },
    documentation: ['docs/profiles.md', 'docs/odoo.md', 'docs/email.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.realTime,
    title: 'Real-Time',
    maturity: 'beta',
    summary:
      'Events, jobs, notifications, scheduler, and optional Server-Sent Events. Not a WebSocket gateway or a separate realtime service.',
    includes: [PROFILE_NAMES.basicWeb],
    capabilities: ['events', 'jobs', 'notifications', 'scheduler', 'realtime', 'frontend.realtime'],
    optionalCapabilities: ['infrastructure.redis', 'automation', 'documents'],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      profiles: { [PROFILE_NAMES.basicWeb]: '^0.1.0' },
    },
    documentation: ['docs/profiles.md', 'docs/realtime.md', 'docs/jobs.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.dataHeavy,
    title: 'Data-Heavy',
    maturity: 'stable',
    summary: 'Jobs, object storage, reports, and Redis. Not a second database or a data lake.',
    includes: [PROFILE_NAMES.basicWeb],
    capabilities: ['jobs', 'storage', 'reports', 'pdf', 'infrastructure.redis'],
    optionalCapabilities: ['adapter.storage.postgres', 'search', 'adapter.search.postgres', 'analytics', 'adapter.analytics.postgres'],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      profiles: { [PROFILE_NAMES.basicWeb]: '^0.1.0' },
    },
    documentation: ['docs/profiles.md', 'docs/jobs.md', 'docs/storage.md', 'docs/search.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.offlineResilient,
    title: 'Offline/Resilient',
    maturity: 'beta',
    summary:
      'Jobs, events, notifications, local storage, and demo-mode mocks. Not an offline-first PWA, sync engine, or CRDT.',
    includes: [PROFILE_NAMES.basicWeb],
    capabilities: ['jobs', 'events', 'notifications', 'storage', 'demo-mode'],
    optionalCapabilities: ['infrastructure.redis'],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      profiles: { [PROFILE_NAMES.basicWeb]: '^0.1.0' },
    },
    documentation: ['docs/profiles.md', 'docs/jobs.md', 'docs/features.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.cloudNative,
    title: 'Cloud-Native',
    maturity: 'experimental',
    summary:
      'Docker Compose, GitHub Actions, and observability metadata. Kubernetes, Helm, and Terraform are not implemented.',
    includes: [PROFILE_NAMES.basicWeb],
    capabilities: ['infrastructure.docker', 'infrastructure.github-actions', 'observability'],
    optionalCapabilities: ['infrastructure.nginx', 'deployment.kubernetes'],
    conflicts: ['architecture.microservices'],
    incompatibleWith: [
      {
        capabilities: ['deployment.kubernetes'],
        message:
          'Kubernetes is experimental and unimplemented. Cloud-Native does not provision a cluster.',
      },
      {
        capabilities: ['architecture.microservices'],
        message: 'Cloud-Native in this kit is Compose + CI metadata, not extra Node services.',
      },
    ],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      profiles: { [PROFILE_NAMES.basicWeb]: '^0.1.0' },
    },
    documentation: ['docs/profiles.md', 'docs/docker.md', 'docs/ci-cd.md'],
  }),
  defineProfile({
    name: PROFILE_NAMES.enterpriseApplication,
    title: 'Enterprise Application',
    maturity: 'enterprise',
    summary:
      'Basic Web plus automation, analytics, audit, and OTP. Compose further with Odoo or AI profiles; do not treat this as a second product.',
    includes: [PROFILE_NAMES.basicWeb, PROFILE_NAMES.automation, PROFILE_NAMES.analytics],
    capabilities: ['audit', 'otp'],
    optionalCapabilities: ['odoo', 'ai', 'ai.guardrails', 'sms'],
    compatibility: {
      platform: '>=0.1.0 <1.0.0',
      capabilities: { audit: '^0.1.0', rbac: '^0.1.0' },
      profiles: {
        [PROFILE_NAMES.basicWeb]: '^0.1.0',
        [PROFILE_NAMES.automation]: '^0.1.0',
        [PROFILE_NAMES.analytics]: '^0.1.0',
      },
    },
    documentation: ['docs/profiles.md', 'docs/audit.md', 'docs/rbac.md'],
  }),
];

export function listPlatformProfiles(): ProjectProfile[] {
  return [...PLATFORM_PROFILES];
}
