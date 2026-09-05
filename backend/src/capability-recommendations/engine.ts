import {
  CapabilityRegistry,
  DEFAULT_ARCHITECTURE_MODE,
  PLATFORM_CAPABILITIES,
  PLATFORM_PROFILES,
  PLATFORM_VERSION,
  PROFILE_NAMES,
  compareCapabilityNames,
  requiredClosure,
  resolveCapabilities,
  resolveProfiles,
  uniqueSortedNames,
  type CapabilityDefinition,
  type ProjectProfile,
} from '../capabilities';
import { classifyMappings, isUnknown } from '../problem-intelligence';
import type {
  ClassifiedMapping,
  ProblemIntelligenceSpec,
  RequirementMappingDraft,
  UnknownableList,
} from '../problem-intelligence';
import { buildCorpus, detectSignals, type RecommendationSignals } from './signals';
import {
  OUT_OF_CATALOG,
  type CapabilityRecommendationInput,
  type CapabilityRecommendationResult,
  type DependencyImpact,
  type ImpactLevel,
  type RecommendationItem,
  type RecommendationKind,
  type RecommendationStatus,
  type SuggestedFeatureFlag,
} from './types';

const NEVER_SELECT = new Set([
  'architecture.microservices',
  'deployment.kubernetes',
]);

const TOOLKIT_OPS = [
  'ai.summarization',
  'ai.classification',
  'ai.extraction',
  'ai.recommendation',
] as const;

const FLAG_BY_CAPABILITY: Record<string, string> = {
  ai: 'FEATURE_AI',
  odoo: 'FEATURE_ODOO',
  automation: 'FEATURE_AUTOMATION',
  notifications: 'FEATURE_NOTIFICATIONS',
  otp: 'FEATURE_OTP',
  sms: 'FEATURE_SMS',
  rag: 'FEATURE_RAG',
  search: 'FEATURE_SEARCH',
  analytics: 'FEATURE_ANALYTICS',
  copilot: 'FEATURE_COPILOT',
  intents: 'FEATURE_INTENTS',
  anomaly: 'FEATURE_ANOMALY_DETECTION',
  realtime: 'FEATURE_REALTIME',
  pdf: 'FEATURE_PDF',
  'adapter.storage.s3': 'FEATURE_S3',
};

export interface RecommendCapabilitiesOptions {
  capabilities?: readonly CapabilityDefinition[];
  profiles?: readonly ProjectProfile[];
}

const EMPTY_SECTION: UnknownableList<never> = { determined: false, items: [] };

export function recommendCapabilities(
  input: CapabilityRecommendationInput,
  options: RecommendCapabilitiesOptions = {},
): CapabilityRecommendationResult {
  const catalog = options.capabilities ?? PLATFORM_CAPABILITIES;
  const profiles = options.profiles ?? PLATFORM_PROFILES;
  const registry = new CapabilityRegistry(catalog);
  const byName = new Map(catalog.map((capability) => [capability.name, capability]));
  const graph = registry.graph();

  const normalized = normalizeAnalysis(input, registry);
  const signals = detectSignals({
    corpus: normalized.corpus,
    mappingNames: normalized.existingNames,
    spec: normalized.spec,
  });

  const baseline = baselineCapabilities();
  const selectedNames = new Set(baseline);

  addIf(selectedNames, true, ...baseline);
  addMappedCapabilities(selectedNames, normalized.existingNames, signals);
  addSignaledCapabilities(selectedNames, signals);
  applyNeverSelect(selectedNames);

  const closed = requiredClosure(graph, [...selectedNames]);
  for (const name of closed) {
    if (!NEVER_SELECT.has(name)) {
      selectedNames.add(name);
    }
  }
  applyNeverSelect(selectedNames);

  const adapters = selectAdapters(selectedNames, signals, byName);
  for (const adapter of adapters) {
    selectedNames.add(adapter);
  }

  const closedWithAdapters = requiredClosure(graph, [...selectedNames]).filter(
    (name) => !NEVER_SELECT.has(name),
  );
  const selectedList = uniqueSortedNames(closedWithAdapters);

  const architectureMode = DEFAULT_ARCHITECTURE_MODE;
  const deploymentMode = selectDeploymentMode(signals);
  const profileNames = selectProfiles(signals, selectedList);

  const architectureItem = modeItem({
    kind: 'architecture-mode',
    name: architectureMode,
    status: 'baseline',
    requirementSatisfied: 'Default architecture for this kit',
    reason:
      'Keep a modular monolith: one Express API and one worker sharing PostgreSQL. Extra Node services are not implemented.',
    confidence: 0.97,
    alternative: {
      name: 'architecture.microservices',
      reason: 'Experimental and unimplemented. Do not split extra Node services unless a written requirement forces it.',
    },
    catalog: byName.get(architectureMode),
  });

  const deploymentItem = modeItem({
    kind: 'deployment-mode',
    name: deploymentMode,
    status: deploymentMode === 'deployment.docker-compose' ? 'recommended' : 'baseline',
    requirementSatisfied: signals.docker
      ? 'Containerized local stack'
      : 'Laptop / hybrid local development',
    reason:
      deploymentMode === 'deployment.docker-compose'
        ? 'The statement asks for Compose. Use the existing frontend/backend/worker/Postgres/Redis stack.'
        : 'Default deployment is host `npm run dev` with optional Compose Postgres/Redis. Full Compose is available when you need it.',
    confidence: signals.docker ? 0.84 : 0.93,
    alternative:
      deploymentMode === 'deployment.docker-compose'
        ? {
            name: 'deployment.local-hybrid',
            reason: 'Use hybrid local npm + Compose deps when you do not need the full container stack.',
          }
        : {
            name: 'deployment.docker-compose',
            reason: 'Use the existing Compose stack when you want one-command services. Kubernetes is experimental and unimplemented.',
          },
    catalog: byName.get(deploymentMode),
  });

  const capabilityItems = selectedList
    .map((name) => byName.get(name))
    .filter((capability): capability is CapabilityDefinition => Boolean(capability))
    .filter((capability) => capability.kind === 'application')
    .map((capability) =>
      buildCapabilityItem({
        capability,
        signals,
        mappings: normalized.mappings,
        baseline: new Set(baseline),
        selected: selectedList,
      }),
    )
    .sort(compareItems);

  const infrastructureItems = selectedList
    .map((name) => byName.get(name))
    .filter((capability): capability is CapabilityDefinition => Boolean(capability))
    .filter((capability) => capability.kind === 'infrastructure')
    .map((capability) =>
      buildCapabilityItem({
        capability,
        signals,
        mappings: normalized.mappings,
        baseline: new Set(baseline),
        selected: selectedList,
        kind: 'infrastructure',
      }),
    )
    .sort(compareItems);

  const adapterItems = selectedList
    .map((name) => byName.get(name))
    .filter((capability): capability is CapabilityDefinition => Boolean(capability))
    .filter((capability) => capability.kind === 'adapter')
    .map((capability) =>
      buildCapabilityItem({
        capability,
        signals,
        mappings: normalized.mappings,
        baseline: new Set(baseline),
        selected: selectedList,
        kind: 'adapter',
      }),
    )
    .sort(compareItems);

  const profileItems = profileNames
    .map((name) => {
      const profile = profiles.find((item) => item.name === name);
      if (!profile) {
        return null;
      }
      return buildProfileItem(profile);
    })
    .filter((item): item is RecommendationItem => Boolean(item))
    .sort(compareItems);

  const rejected = buildRejected(signals).sort(compareItems);

  const resolution = resolveCapabilities({
    capabilities: catalog,
    selected: selectedList,
    architectureMode,
    deploymentMode,
  });

  const notes = uniqueNotes([
    'Recommendations are advisory. Human selection remains authoritative.',
    'Nothing was enabled. Do not treat this list as FEATURE_* or a generated project.',
    'Required dependencies are listed explicitly. Optional extras (RAG, SMS, S3, Kafka, Kubernetes) stay off unless justified.',
    ...normalized.uncertainty,
    resolution.valid
      ? 'The recommended closed set validates against the capability resolver.'
      : 'The recommended set still has resolver issues. Review missing dependencies before enabling flags.',
  ]);

  const itemsForConfidence = [
    architectureItem,
    deploymentItem,
    ...profileItems,
    ...capabilityItems,
    ...adapterItems,
    ...infrastructureItems,
  ];
  const confidence = averageConfidence(itemsForConfidence);

  return {
    advisory: true,
    humanSelectionAuthoritative: true,
    enabledNothing: true,
    architectureMode: architectureItem,
    deploymentMode: deploymentItem,
    profiles: profileItems,
    capabilities: capabilityItems,
    adapters: adapterItems,
    infrastructure: infrastructureItems,
    rejected,
    selected: {
      capabilities: selectedList.filter((name) => byName.get(name)?.kind === 'application'),
      profiles: profileNames,
      adapters: selectedList.filter((name) => byName.get(name)?.kind === 'adapter'),
      infrastructure: selectedList.filter((name) => byName.get(name)?.kind === 'infrastructure'),
      architectureMode,
      deploymentMode,
    },
    featureFlags: suggestFeatureFlags(selectedList),
    resolution: {
      valid: resolution.valid,
      selected: resolution.selected,
      ordered: resolution.ordered,
      required: resolution.required,
      missing: resolution.missing,
      optionalMissing: resolution.optionalMissing,
      issueCount: resolution.issues.length,
    },
    notes,
    unknowns: uniqueNotes(normalized.unknowns),
    confidence,
    catalogVersion: PLATFORM_VERSION,
  };
}

function normalizeAnalysis(
  input: CapabilityRecommendationInput,
  registry: CapabilityRegistry,
): {
  spec: ProblemIntelligenceSpec;
  mappings: ClassifiedMapping[];
  existingNames: string[];
  corpus: string;
  unknowns: string[];
  uncertainty: string[];
} {
  const spec = normalizeSpec(input.spec, input.problemSummary);
  const drafts: RequirementMappingDraft[] = (input.mappings ?? []).map((mapping) => ({
    requirement: mapping.requirement,
    category: mapping.category,
    existingCapability: existingName(mapping.existingCapability),
    newProblemLogic:
      'newProblemLogic' in mapping && mapping.newProblemLogic && !isUnknown(mapping.newProblemLogic)
        ? mapping.newProblemLogic
        : 'unknown',
    confidence: mapping.confidence,
    evidence: mapping.evidence,
  }));
  const classified = classifyMappings(drafts, registry);
  const existingNames = uniqueSortedNames([
    ...classified.mappings
      .map((mapping) => mapping.existingCapability?.name)
      .filter((name): name is string => Boolean(name)),
    ...(input.existingCapabilities ?? []).map((item) => item.name),
  ]);
  const newProblemLogic =
    input.newProblemLogic ??
    classified.mappings
      .filter((mapping) => Boolean(mapping.newProblemLogic))
      .map((mapping) => ({ requirement: mapping.requirement, logic: mapping.newProblemLogic as string }));
  const unknowns = [...(input.unknowns ?? [])];
  const uncertainty = [...(input.uncertainty ?? []), ...classified.uncertainty];
  const corpus = buildCorpus({
    spec,
    mappings: classified.mappings,
    existingNames,
    newProblemLogic,
    unknowns,
    uncertainty,
    problemSummary: input.problemSummary,
  });

  return {
    spec,
    mappings: classified.mappings,
    existingNames,
    corpus,
    unknowns,
    uncertainty,
  };
}

function normalizeSpec(
  spec: Partial<ProblemIntelligenceSpec> | null | undefined,
  problemSummary?: string,
): ProblemIntelligenceSpec {
  return {
    problemSummary: spec?.problemSummary ?? problemSummary ?? 'unknown',
    users: spec?.users ?? EMPTY_SECTION,
    actors: spec?.actors ?? EMPTY_SECTION,
    workflows: spec?.workflows ?? EMPTY_SECTION,
    entities: spec?.entities ?? EMPTY_SECTION,
    businessRules: spec?.businessRules ?? EMPTY_SECTION,
    integrations: spec?.integrations ?? EMPTY_SECTION,
    odooRequirements: spec?.odooRequirements ?? EMPTY_SECTION,
    aiRequirements: spec?.aiRequirements ?? EMPTY_SECTION,
    automationRequirements: spec?.automationRequirements ?? EMPTY_SECTION,
    notifications: spec?.notifications ?? EMPTY_SECTION,
    documents: spec?.documents ?? EMPTY_SECTION,
    reports: spec?.reports ?? EMPTY_SECTION,
    securityRequirements: spec?.securityRequirements ?? EMPTY_SECTION,
    nonFunctionalRequirements: spec?.nonFunctionalRequirements ?? EMPTY_SECTION,
    likelyDataRequirements: spec?.likelyDataRequirements ?? EMPTY_SECTION,
    likelyInfrastructureRequirements: spec?.likelyInfrastructureRequirements ?? EMPTY_SECTION,
  };
}

function existingName(
  value: ClassifiedMapping['existingCapability'] | RequirementMappingDraft['existingCapability'] | null | undefined,
): string {
  if (!value || isUnknown(value)) {
    return 'unknown';
  }
  if (typeof value === 'string') {
    return value;
  }
  return value.name;
}

function baselineCapabilities(): string[] {
  return uniqueSortedNames(resolveProfiles({ profiles: [PROFILE_NAMES.basicWeb] }).composed);
}

function addMappedCapabilities(
  selected: Set<string>,
  names: readonly string[],
  signals: RecommendationSignals,
): void {
  for (const name of names) {
    if (NEVER_SELECT.has(name)) {
      continue;
    }
    if (name === 'rag' && !signals.searchSemantic) {
      continue;
    }
    if (name === 'adapter.storage.s3' && !signals.s3) {
      continue;
    }
    if (name === 'sms' && !signals.sms) {
      continue;
    }
    if (name === 'infrastructure.nginx' && !signals.nginx) {
      continue;
    }
    selected.add(name);
  }
}

function addSignaledCapabilities(selected: Set<string>, signals: RecommendationSignals): void {
  addIf(selected, true, 'database', 'infrastructure.postgres');
  addIf(selected, signals.odoo, 'odoo', 'adapter.odoo.json2');
  addIf(selected, signals.ai, 'ai', 'ai.guardrails', 'frontend.ai');
  for (const name of TOOLKIT_OPS) {
    if (signals.mappingNames.includes(name) || toolkitMentioned(signals.corpus, name)) {
      selected.add(name);
      selected.add('ai');
      selected.add('ai.guardrails');
    }
  }
  addIf(selected, signals.documents, 'documents', 'storage', 'adapter.storage.local');
  addIf(selected, signals.jobs || signals.eventStreaming, 'jobs');
  addIf(selected, signals.eventStreaming || signals.automation, 'events');
  addIf(selected, signals.automation, 'automation', 'events', 'jobs');
  addIf(selected, signals.scheduler, 'scheduler', 'events');
  addIf(selected, signals.notifications, 'notifications');
  addIf(selected, signals.email, 'email');
  addIf(selected, signals.sms, 'sms');
  addIf(selected, signals.otp, 'otp');
  addIf(selected, signals.reports, 'reports', 'pdf', 'storage');
  addIf(selected, signals.pdf && !signals.reports, 'pdf');
  addIf(selected, signals.storage, 'storage');
  addIf(selected, signals.webhooks, 'webhooks');
  addIf(selected, signals.copilot, 'copilot', 'ai', 'ai.guardrails', 'frontend.copilot');
  addIf(selected, signals.intents, 'intents', 'ai', 'ai.guardrails');
  addIf(selected, signals.rag, 'rag', 'ai', 'ai.guardrails');
  addIf(selected, signals.searchSimple || signals.searchLargeScale, 'search', 'frontend.search');
  addIf(selected, signals.analytics, 'analytics', 'frontend.analytics', 'frontend.dashboard', 'frontend.charts');
  addIf(selected, signals.anomaly, 'anomaly');
  addIf(selected, signals.realtime, 'realtime', 'jobs', 'events', 'notifications', 'frontend.realtime');
  addIf(selected, signals.dashboard, 'frontend.dashboard', 'frontend.charts');
  addIf(selected, signals.audit, 'audit');
  addIf(selected, signals.redis, 'infrastructure.redis');
  addIf(selected, signals.docker, 'infrastructure.docker');
  addIf(selected, signals.nginx, 'infrastructure.nginx', 'infrastructure.docker');
  addIf(selected, signals.s3, 'storage', 'adapter.storage.s3');
  addIf(selected, signals.demo, 'demo-mode');
}

function toolkitMentioned(corpus: string, name: string): boolean {
  const aliases: Record<string, string[]> = {
    'ai.summarization': ['summarize', 'summarisation', 'summarization'],
    'ai.classification': ['classify', 'classification', 'sentiment'],
    'ai.extraction': ['extract fields', 'extraction', 'entities'],
    'ai.recommendation': ['ai recommend', 'recommendation engine for users'],
  };
  return (aliases[name] ?? []).some((alias) => corpus.includes(alias));
}

function applyNeverSelect(selected: Set<string>): void {
  for (const name of NEVER_SELECT) {
    selected.delete(name);
  }
}

function selectAdapters(
  selected: Set<string>,
  signals: RecommendationSignals,
  byName: Map<string, CapabilityDefinition>,
): string[] {
  const adapters: string[] = [];
  const add = (name: string) => {
    if (byName.has(name) && !NEVER_SELECT.has(name)) {
      adapters.push(name);
    }
  };

  if (selected.has('ai')) {
    add(signals.demo || !signals.corpus.includes('gemini') ? 'adapter.ai.mock' : 'adapter.ai.gemini');
  }
  if (selected.has('email')) {
    add('adapter.email.mock');
  }
  if (selected.has('sms')) {
    add('adapter.sms.mock');
  }
  if (selected.has('storage') && !signals.s3) {
    add('adapter.storage.local');
  }
  if (selected.has('odoo')) {
    add('adapter.odoo.json2');
  }
  if (selected.has('otp')) {
    add('adapter.otp.mock');
  }
  if (selected.has('rag')) {
    add(signals.searchLargeScale || selected.has('infrastructure.postgres')
      ? 'adapter.rag.vector.postgres'
      : 'adapter.rag.vector.memory');
    add(signals.demo ? 'adapter.rag.embedding.lexical' : 'adapter.rag.embedding.ai');
  }
  if (selected.has('search')) {
    add('adapter.search.postgres');
  }
  if (selected.has('analytics')) {
    add('adapter.analytics.postgres');
  }
  if (selected.has('webhooks')) {
    add('adapter.webhook.http');
  }
  if (selected.has('notifications')) {
    add('adapter.push.mock');
  }

  return uniqueSortedNames(adapters);
}

function selectDeploymentMode(signals: RecommendationSignals): string {
  if (signals.kubernetes) {
    return 'deployment.docker-compose';
  }
  if (signals.docker) {
    return 'deployment.docker-compose';
  }
  return 'deployment.local-hybrid';
}

function selectProfiles(signals: RecommendationSignals, selected: readonly string[]): string[] {
  const names = new Set<string>([PROFILE_NAMES.basicWeb]);
  const has = (name: string) => selected.includes(name);
  if (signals.ai || has('ai')) {
    names.add(PROFILE_NAMES.aiApplication);
  }
  if (signals.odoo || has('odoo')) {
    names.add(PROFILE_NAMES.odooApplication);
  }
  if (signals.documents || has('documents')) {
    names.add(PROFILE_NAMES.documentIntelligence);
  }
  if (signals.automation || has('automation')) {
    names.add(PROFILE_NAMES.automation);
  }
  if (signals.reports || signals.dashboard || has('reports') || has('frontend.dashboard')) {
    names.add(PROFILE_NAMES.analytics);
  }
  const integrationCount = ['odoo', 'email', 'sms', 'storage', 'webhooks', 'otp'].filter((name) =>
    has(name),
  ).length;
  if (integrationCount >= 4) {
    names.add(PROFILE_NAMES.integrationHeavy);
  }
  if (signals.realtime && (has('realtime') || (has('jobs') && has('events') && has('notifications')))) {
    names.add(PROFILE_NAMES.realTime);
  }
  if (has('jobs') && has('storage') && has('infrastructure.redis')) {
    names.add(PROFILE_NAMES.dataHeavy);
  }
  if (signals.offline && has('jobs') && has('storage')) {
    names.add(PROFILE_NAMES.offlineResilient);
  }
  if (signals.automation && has('reports') && has('audit') && has('otp')) {
    names.add(PROFILE_NAMES.enterpriseApplication);
  }
  return uniqueSortedNames([...names]);
}

function addIf(selected: Set<string>, enabled: boolean, ...names: string[]): void {
  if (!enabled) {
    return;
  }
  for (const name of names) {
    selected.add(name);
  }
}

function buildCapabilityItem(input: {
  capability: CapabilityDefinition;
  signals: RecommendationSignals;
  mappings: readonly ClassifiedMapping[];
  baseline: Set<string>;
  selected: readonly string[];
  kind?: RecommendationKind;
}): RecommendationItem {
  const { capability, signals, mappings, baseline } = input;
  const mapping = mappings.find((item) => item.existingCapability?.name === capability.name);
  const policy = capabilityPolicy(capability.name, signals);
  const status: RecommendationStatus = baseline.has(capability.name) ? 'baseline' : 'recommended';
  const kind =
    input.kind ??
    (capability.kind === 'adapter'
      ? 'adapter'
      : capability.kind === 'infrastructure'
        ? 'infrastructure'
        : 'capability');

  return item({
    kind,
    status,
    capabilitySelected: capability.name,
    requirementSatisfied: mapping?.requirement ?? policy.requirement,
    reason: mapping ? `${policy.reason} Classified from requirement mapping.` : policy.reason,
    dependencyImpact: dependencyImpact(capability, input.selected),
    complexityImpact: complexityImpact(capability),
    securityImpact: securityImpact(capability),
    confidence: clampConfidence(mapping?.confidence ?? policy.confidence),
    alternative: policy.alternative,
  });
}

function buildProfileItem(profile: ProjectProfile): RecommendationItem {
  const requirement =
    profile.name === PROFILE_NAMES.basicWeb
      ? 'Authenticated web application on this kit'
      : `Closest named composition for ${profile.title.toLowerCase()}`;
  return item({
    kind: 'profile',
    status: profile.name === PROFILE_NAMES.basicWeb ? 'baseline' : 'recommended',
    capabilitySelected: profile.name,
    requirementSatisfied: requirement,
    reason: `${profile.summary} Optional extras on the profile stay off unless separately justified.`,
    dependencyImpact: {
      adds: uniqueSortedNames([...profile.capabilities]),
      optional: uniqueSortedNames([...profile.optionalCapabilities]),
      missingIfSelected: [],
    },
    complexityImpact: profile.maturity === 'experimental' ? 'high' : profile.maturity === 'enterprise' ? 'medium' : 'low',
    securityImpact: profile.name === PROFILE_NAMES.integrationHeavy ? 'medium' : 'low',
    confidence: profile.name === PROFILE_NAMES.basicWeb ? 0.95 : 0.8,
    alternative: {
      name: 'select capabilities directly',
      reason: 'Profiles are optional shortcuts. You may pass names to resolveCapabilities instead.',
    },
  });
}

function capabilityPolicy(
  name: string,
  signals: RecommendationSignals,
): {
  requirement: string;
  reason: string;
  confidence: number;
  alternative: RecommendationItem['alternative'];
} {
  if (name === 'database' || name === 'infrastructure.postgres') {
    if (signals.searchSimple || signals.searchLargeScale || signals.searchSemantic) {
      return {
        requirement: signals.searchSemantic
          ? 'Application data plus keyword fallback for search'
          : 'Search / persist application records',
        reason:
          'PostgreSQL is the kit database. Simple and large-scale lookup use SearchService on Postgres. Do not add Elasticsearch or a second database.',
        confidence: signals.searchLargeScale ? 0.86 : 0.94,
        alternative: {
          name: signals.searchSemantic ? 'rag' : 'search',
          reason: signals.searchSemantic
            ? 'Optional RAG covers meaning search. Elasticsearch is not in this catalog.'
            : 'Use SearchService on PostgreSQL. Elasticsearch is not in this kit.',
        },
      };
    }
    return {
      requirement: 'Persistent application records',
      reason: 'PostgreSQL via Prisma is the only application database.',
      confidence: 0.96,
      alternative: {
        name: 'none',
        reason: 'Do not add MongoDB, an extra ORM, or a second database.',
      },
    };
  }

  if (name === 'jobs') {
    return {
      requirement: 'Background / asynchronous work',
      reason: 'Use the existing in-memory, file, or BullMQ job system. Redis is optional locally.',
      confidence: 0.92,
      alternative: {
        name: OUT_OF_CATALOG.kafka,
        reason: 'Kafka is not in this kit. Distributed event streaming is only justified by a written requirement, and even then it is outside the catalog.',
      },
    };
  }

  if (name === 'events') {
    return {
      requirement: signals.eventStreaming ? 'Application events without a streaming cluster' : 'In-process domain events',
      reason: 'The in-process EventBus plus jobs covers automation and async fan-out. Cross-process work uses the queue, not Kafka.',
      confidence: 0.88,
      alternative: {
        name: OUT_OF_CATALOG.kafka,
        reason: 'Do not add Kafka, Kinesis, or Pulsar unless a written distributed-streaming requirement exists.',
      },
    };
  }

  if (name === 'realtime' || name === 'frontend.realtime') {
    return {
      requirement: 'Live status without a socket gateway',
      reason:
        'Optional Server-Sent Events cover job progress, notifications, dashboards, automation, and document processing. REST polling stays available when FEATURE_REALTIME is off.',
      confidence: 0.86,
      alternative: {
        name: 'jobs',
        reason: 'Do not add WebSockets or a separate realtime service. Poll GET /api/v1/jobs/:jobId when SSE is not needed.',
      },
    };
  }

  if (
    name === 'search' ||
    name === 'frontend.search' ||
    name === 'adapter.search.postgres' ||
    name === 'adapter.search.memory'
  ) {
    return {
      requirement: 'Keyword / full-text lookup with filters, sort, and pagination',
      reason:
        name === 'adapter.search.memory'
          ? 'In-memory search is for tests and processes without PostgreSQL.'
          : 'Use SearchService with the PostgreSQL adapter. Application services must not import Elasticsearch. Fuzzy matching is limited to short typed queries via pg_trgm.',
      confidence: 0.9,
      alternative: {
        name: OUT_OF_CATALOG.elasticsearch,
        reason:
          'Elasticsearch is not implemented in this kit. A future SearchProvider adapter can be added without changing application services, and only if a written scale requirement forces it.',
      },
    };
  }

  if (
    name === 'analytics' ||
    name === 'frontend.analytics' ||
    name === 'adapter.analytics.postgres' ||
    name === 'adapter.analytics.memory'
  ) {
    return {
      requirement: 'KPIs, aggregations, time-series, dashboards, filters, and exports',
      reason:
        name === 'adapter.analytics.memory'
          ? 'In-memory analytics is for tests and processes without PostgreSQL.'
          : 'Use AnalyticsService on PostgreSQL with indexed facts. Application services must not query ClickHouse, BigQuery, or Snowflake. Problem-specific metrics are registered from modules/problem.',
      confidence: 0.9,
      alternative: {
        name: OUT_OF_CATALOG.clickhouse,
        reason:
          'A warehouse is not implemented in this kit. A future AnalyticsProvider adapter can be added without changing application services, and only if a written scale requirement forces it.',
      },
    };
  }

  if (name === 'rag') {
    return {
      requirement: 'Semantic / meaning search',
      reason:
        'Optional RAG is justified for semantic search. The shipped Postgres store holds JSON embeddings; pgvector is not in this catalog.',
      confidence: 0.84,
      alternative: {
        name: 'database',
        reason: 'PostgreSQL keyword or full-text search is enough when the need is simple lookup, not meaning.',
      },
    };
  }

  if (name.startsWith('adapter.rag.vector')) {
    return {
      requirement: 'Vector store for semantic search',
      reason:
        name === 'adapter.rag.vector.postgres'
          ? 'Use the PostgreSQL JSON embedding store. This is not pgvector and not Elasticsearch.'
          : 'In-memory vectors are enough for tests and small demos.',
      confidence: 0.8,
      alternative: {
        name: OUT_OF_CATALOG.pgvector,
        reason: 'pgvector is not registered in this kit. Do not add Elasticsearch for semantic search on a hackathon timeline.',
      },
    };
  }

  if (name === 'adapter.storage.local') {
    return {
      requirement: 'File uploads',
      reason: 'Local storage is the default. S3 stays off unless object storage at scale is required.',
      confidence: 0.9,
      alternative: {
        name: 'adapter.storage.s3',
        reason: 'Enable S3 only when FEATURE_S3 / STORAGE_PROVIDER=s3 is a written requirement.',
      },
    };
  }

  if (name === 'adapter.ai.mock' || name === 'adapter.email.mock' || name === 'adapter.sms.mock' || name === 'adapter.otp.mock') {
    return {
      requirement: 'Safe demo / test provider',
      reason: 'Mock adapters keep secrets off the laptop and never deliver real mail/SMS.',
      confidence: 0.9,
      alternative: {
        name: name.replace('.mock', name.includes('ai') ? '.gemini' : name.includes('email') ? '.smtp' : '.http'),
        reason: 'Switch to a live adapter only when the demo cannot use mocks.',
      },
    };
  }

  return {
    requirement: requirementFor(name, signals),
    reason: `Selected because the structured analysis justifies ${name}. Optional unrelated modules stay off.`,
    confidence: 0.8,
    alternative: defaultAlternative(name),
  };
}

function requirementFor(name: string, signals: RecommendationSignals): string {
  if (name === 'auth' || name === 'rbac') {
    return 'Authenticated access and authorization';
  }
  if (name === 'odoo') {
    return 'ERP read/write through Odoo';
  }
  if (name === 'ai' || name === 'ai.guardrails') {
    return 'Language / extraction / classification work';
  }
  if (name === 'documents') {
    return 'Upload and extract documents';
  }
  if (name === 'automation') {
    return 'Declarative if-this-then-that workflows';
  }
  if (signals.demo && name === 'demo-mode') {
    return 'Safe judged demo without paid APIs';
  }
  return `Requirement mapped to ${name}`;
}

function defaultAlternative(name: string): RecommendationItem['alternative'] {
  if (name === 'sms') {
    return { name: 'notifications', reason: 'Prefer in-app or email unless SMS is a stated requirement.' };
  }
  if (name === 'copilot') {
    return { name: 'omit copilot', reason: 'A chat assistant is optional. Do not enable it for a form-only golden path.' };
  }
  if (name === 'intents') {
    return { name: 'omit intents', reason: 'Use a normal HTTP action unless natural-language commands are the golden path.' };
  }
  return {
    name: 'omit this capability',
    reason: 'Leave it off if the golden path does not need it.',
  };
}

function buildRejected(signals: RecommendationSignals): RecommendationItem[] {
  const items: RecommendationItem[] = [];

  if (signals.searchSimple || signals.searchLargeScale || signals.searchSemantic || signals.corpus.includes('elasticsearch')) {
    items.push(
      rejectedItem({
        kind: 'infrastructure',
        name: OUT_OF_CATALOG.elasticsearch,
        requirementSatisfied: signals.searchLargeScale
          ? 'Large-scale search'
          : 'Search',
        reason: signals.searchLargeScale
          ? 'Elasticsearch would only be justified by a written distributed-search requirement. It is not in this catalog; stay on PostgreSQL (and optional RAG for meaning).'
          : 'Simple and semantic search are covered by PostgreSQL and optional RAG. Do not add Elasticsearch.',
        alternative: {
          name: signals.searchSemantic ? 'rag' : 'search',
          reason: 'Use SearchService on Postgres for keyword/full-text lookup and optional RAG for meaning search.',
        },
        complexityImpact: 'high',
        securityImpact: 'medium',
        confidence: 0.9,
      }),
    );
  }

  if (
    signals.analytics ||
    signals.corpus.includes('clickhouse') ||
    signals.corpus.includes('bigquery') ||
    signals.corpus.includes('snowflake')
  ) {
    items.push(
      rejectedItem({
        kind: 'infrastructure',
        name: OUT_OF_CATALOG.clickhouse,
        requirementSatisfied: 'Analytics warehouse',
        reason:
          'ClickHouse, BigQuery, and Snowflake are not in this catalog. Use AnalyticsService on PostgreSQL with indexed kpi_key + occurred_at queries.',
        alternative: {
          name: 'analytics',
          reason: 'Register KPI definitions and ingest generic facts. Do not add a warehouse on a hackathon timeline.',
        },
        complexityImpact: 'high',
        securityImpact: 'medium',
        confidence: 0.9,
      }),
    );
  }

  if (signals.searchSemantic || signals.pgvector) {
    items.push(
      rejectedItem({
        kind: 'adapter',
        name: OUT_OF_CATALOG.pgvector,
        requirementSatisfied: 'Semantic search storage',
        reason: 'pgvector is not a registered capability. The kit stores embeddings as JSON in PostgreSQL or in memory.',
        alternative: {
          name: 'adapter.rag.vector.postgres',
          reason: 'Use the shipped RAG vector adapters. Do not add a new database extension automatically.',
        },
        complexityImpact: 'medium',
        securityImpact: 'low',
        confidence: 0.88,
      }),
    );
  }

  if (signals.jobs || signals.eventStreaming) {
    items.push(
      rejectedItem({
        kind: 'infrastructure',
        name: OUT_OF_CATALOG.kafka,
        requirementSatisfied: signals.eventStreaming
          ? 'Distributed event streaming'
          : 'Background jobs',
        reason: signals.eventStreaming
          ? 'Kafka is not in this kit. Use the EventBus plus the existing job system unless a written streaming requirement forces an external broker — and even then do not add it automatically.'
          : 'Background work uses the existing job system. Kafka is unnecessary.',
        alternative: {
          name: 'jobs',
          reason: 'In-memory, file, or BullMQ queues already cover async work.',
        },
        complexityImpact: 'high',
        securityImpact: 'high',
        confidence: 0.93,
      }),
    );
  }

  if (signals.microservices) {
    items.push(
      rejectedItem({
        kind: 'architecture-mode',
        name: 'architecture.microservices',
        requirementSatisfied: 'Independently deployable services',
        reason: 'Microservices are experimental and unimplemented. Keep the modular monolith.',
        alternative: {
          name: DEFAULT_ARCHITECTURE_MODE,
          reason: 'One API and one worker sharing PostgreSQL is the supported architecture.',
        },
        complexityImpact: 'high',
        securityImpact: 'high',
        confidence: 0.96,
      }),
    );
  }

  if (signals.kubernetes) {
    items.push(
      rejectedItem({
        kind: 'deployment-mode',
        name: 'deployment.kubernetes',
        requirementSatisfied: 'Cluster deployment',
        reason: 'Kubernetes is experimental and unimplemented. Use Compose or local-hybrid.',
        alternative: {
          name: 'deployment.docker-compose',
          reason: 'The existing Compose stack is the supported container path.',
        },
        complexityImpact: 'high',
        securityImpact: 'high',
        confidence: 0.95,
      }),
    );
  }

  return items;
}

function suggestFeatureFlags(selected: readonly string[]): SuggestedFeatureFlag[] {
  const flags: SuggestedFeatureFlag[] = [];
  for (const [capability, name] of Object.entries(FLAG_BY_CAPABILITY)) {
    if (!selected.includes(capability) && !(capability === 'adapter.storage.s3' && selected.includes('adapter.storage.s3'))) {
      continue;
    }
    if (capability === 'pdf' && !selected.includes('pdf') && !selected.includes('reports')) {
      continue;
    }
    flags.push({
      name,
      suggested: true,
      reason: `Advisory only. Set ${name}=true yourself if you accept ${capability}. The engine does not write .env.`,
      capability,
    });
  }
  return flags.sort((left, right) => compareCapabilityNames(left.name, right.name));
}

function dependencyImpact(capability: CapabilityDefinition, selected: readonly string[]): DependencyImpact {
  const adds = uniqueSortedNames([...capability.dependencies]);
  const optional = uniqueSortedNames([...capability.optionalDependencies]);
  return {
    adds,
    optional,
    missingIfSelected: adds.filter((name) => !selected.includes(name)),
  };
}

function complexityImpact(capability: CapabilityDefinition): ImpactLevel {
  if (capability.maturity === 'experimental') {
    return 'high';
  }
  if (
    ['rag', 'copilot', 'intents', 'odoo', 'automation', 'anomaly', 'documents'].includes(capability.name) ||
    capability.name === 'adapter.storage.s3'
  ) {
    return 'medium';
  }
  if (capability.kind === 'architecture-mode' && capability.name === DEFAULT_ARCHITECTURE_MODE) {
    return 'none';
  }
  return 'low';
}

function securityImpact(capability: CapabilityDefinition): ImpactLevel {
  const env = capability.environmentRequirements.join(' ');
  if (/API_KEY|AWS_|JWT_|ODOO_/.test(env) || capability.name === 'odoo' || capability.name.includes('s3')) {
    return 'high';
  }
  if (capability.name === 'ai' || capability.name.startsWith('adapter.ai') || capability.name === 'sms') {
    return 'medium';
  }
  if (['auth', 'rbac', 'security', 'audit'].includes(capability.name)) {
    return 'low';
  }
  return 'low';
}

function modeItem(input: {
  kind: RecommendationKind;
  name: string;
  status: RecommendationStatus;
  requirementSatisfied: string;
  reason: string;
  confidence: number;
  alternative: RecommendationItem['alternative'];
  catalog?: CapabilityDefinition;
}): RecommendationItem {
  return item({
    kind: input.kind,
    status: input.status,
    capabilitySelected: input.name,
    requirementSatisfied: input.requirementSatisfied,
    reason: input.reason,
    dependencyImpact: input.catalog
      ? dependencyImpact(input.catalog, [input.name])
      : { adds: [], optional: [], missingIfSelected: [] },
    complexityImpact: input.name.includes('microservices') || input.name.includes('kubernetes') ? 'high' : 'none',
    securityImpact: 'none',
    confidence: input.confidence,
    alternative: input.alternative,
  });
}

function rejectedItem(input: {
  kind: RecommendationKind;
  name: string;
  requirementSatisfied: string;
  reason: string;
  alternative: RecommendationItem['alternative'];
  complexityImpact: ImpactLevel;
  securityImpact: ImpactLevel;
  confidence: number;
}): RecommendationItem {
  return {
    ...item({
      kind: input.kind,
      status: 'not_recommended',
      capabilitySelected: input.name,
      requirementSatisfied: input.requirementSatisfied,
      reason: input.reason,
      dependencyImpact: { adds: [], optional: [], missingIfSelected: [] },
      complexityImpact: input.complexityImpact,
      securityImpact: input.securityImpact,
      confidence: input.confidence,
      alternative: input.alternative,
    }),
  };
}

function item(input: {
  kind: RecommendationKind;
  status: RecommendationStatus;
  capabilitySelected: string;
  requirementSatisfied: string;
  reason: string;
  dependencyImpact: DependencyImpact;
  complexityImpact: ImpactLevel;
  securityImpact: ImpactLevel;
  confidence: number;
  alternative: RecommendationItem['alternative'];
}): RecommendationItem {
  return {
    id: `${input.kind}:${input.capabilitySelected}`,
    kind: input.kind,
    status: input.status,
    requirementSatisfied: input.requirementSatisfied,
    capabilitySelected: input.capabilitySelected,
    reason: input.reason,
    dependencyImpact: input.dependencyImpact,
    complexityImpact: input.complexityImpact,
    securityImpact: input.securityImpact,
    confidence: clampConfidence(input.confidence),
    alternative: input.alternative,
    advisory: true,
  };
}

function compareItems(left: RecommendationItem, right: RecommendationItem): number {
  return compareCapabilityNames(left.capabilitySelected, right.capabilitySelected);
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, Math.round(value * 1000) / 1000));
}

function averageConfidence(items: readonly RecommendationItem[]): number {
  if (items.length === 0) {
    return 0;
  }
  const total = items.reduce((sum, item) => sum + item.confidence, 0);
  return clampConfidence(total / items.length);
}

function uniqueNotes(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
