import { uniqueSortedNames } from '../capabilities';
import { isUnknown, type UnknownableList } from '../problem-intelligence';
import type { ClassifiedMapping, NamedItem, ProblemIntelligenceSpec } from '../problem-intelligence';

export interface RecommendationSignals {
  corpus: string;
  mappingNames: string[];
  searchSimple: boolean;
  searchSemantic: boolean;
  searchLargeScale: boolean;
  jobs: boolean;
  eventStreaming: boolean;
  microservices: boolean;
  kubernetes: boolean;
  docker: boolean;
  redis: boolean;
  nginx: boolean;
  odoo: boolean;
  ai: boolean;
  documents: boolean;
  notifications: boolean;
  email: boolean;
  sms: boolean;
  otp: boolean;
  automation: boolean;
  scheduler: boolean;
  reports: boolean;
  pdf: boolean;
  copilot: boolean;
  intents: boolean;
  rag: boolean;
  anomaly: boolean;
  s3: boolean;
  storage: boolean;
  webhooks: boolean;
  dashboard: boolean;
  analytics: boolean;
  audit: boolean;
  ci: boolean;
  demo: boolean;
  realtime: boolean;
  offline: boolean;
  pgvector: boolean;
}

const SIMPLE_SEARCH = [
  /\bkeyword search\b/i,
  /\bfull[- ]text search\b/i,
  /\bsearch (customer |user |order |product |record |records |items |by name|by title)/i,
  /\blook(?:s|ed|ing)? up\b/i,
  /\bfilter (records|results|the list)\b/i,
  /\b(sql|postgres(ql)?)\s+(like|ilike)\b/i,
];

const SEMANTIC_SEARCH = [
  /\bsemantic search\b/i,
  /\bsearch by meaning\b/i,
  /\b(vector|embedding)s?\b/i,
  /\bsimilar(ity)? (document|documents|search)\b/i,
  /\bpgvector\b/i,
  /\b\brag\b/i,
];

const LARGE_SCALE_SEARCH = [
  /\belasticsearch\b/i,
  /\bopensearch\b/i,
  /\bsolr\b/i,
  /\bsearch cluster\b/i,
  /\blarge[- ]scale search\b/i,
  /\bbillions of (documents|records)\b/i,
  /\bdistributed search\b/i,
];

export function detectSignals(input: {
  corpus: string;
  mappingNames: readonly string[];
  spec: ProblemIntelligenceSpec;
}): RecommendationSignals {
  const corpus = input.corpus;
  const names = new Set(input.mappingNames);
  const has = (name: string) => names.has(name);
  const match = (patterns: readonly RegExp[]) => patterns.some((pattern) => pattern.test(corpus));
  const section = (list: UnknownableList<unknown>) => list.determined && list.items.length > 0;

  const searchSemantic =
    has('rag') || match(SEMANTIC_SEARCH) || mentions(corpus, ['search by meaning']);
  const searchLargeScale = match(LARGE_SCALE_SEARCH);
  const searchSimple =
    (match(SIMPLE_SEARCH) || (/\bsearch\b/i.test(corpus) && !searchSemantic && !searchLargeScale)) &&
    !searchSemantic;

  const eventStreaming = match([
    /\bkafka\b/i,
    /\bkinesis\b/i,
    /\bpulsar\b/i,
    /\bevent streaming\b/i,
    /\bdistributed (event|streaming)\b/i,
    /\bmillions of events\b/i,
  ]);

  const documents = has('documents') || section(input.spec.documents);
  const reports = has('reports') || has('pdf') || section(input.spec.reports);
  const automation = has('automation') || section(input.spec.automationRequirements);
  const jobsFromText = match([
    /\bbackground jobs?\b/i,
    /\basync(hronous)? (work|job|email|pdf|processing)\b/i,
    /\bjob queue\b/i,
    /\bbullmq\b/i,
    /\bworker process\b/i,
  ]);

  const odoo = has('odoo') || has('adapter.odoo.json2') || section(input.spec.odooRequirements);
  const ai =
    has('ai') ||
    has('ai.guardrails') ||
    has('ai.summarization') ||
    has('ai.classification') ||
    has('ai.extraction') ||
    has('ai.recommendation') ||
    section(input.spec.aiRequirements);
  const notifications = has('notifications') || section(input.spec.notifications);
  const email = has('email') || mentions(corpus, ['smtp', 'transactional email', 'send email']);
  const sms = has('sms') || mentions(corpus, ['sms', 'text message']);
  const copilot = has('copilot') || mentions(corpus, ['copilot', 'chat assistant', 'chatbot']);
  const intents =
    has('intents') || mentions(corpus, ['natural language action', 'from a sentence', 'nl command']);
  const rag = searchSemantic || has('rag');
  const anomaly =
    has('anomaly') || mentions(corpus, ['anomaly', 'spike detection', 'outlier', 'z-score']);
  const s3 = has('adapter.storage.s3') || mentions(corpus, ['s3', 'aws object storage']);
  const storage = has('storage') || documents || reports || s3 || section(input.spec.documents);
  const docker =
    has('infrastructure.docker') ||
    has('deployment.docker-compose') ||
    mentions(corpus, ['docker compose', 'docker-compose', 'containers']);
  const kubernetes =
    has('deployment.kubernetes') || mentions(corpus, ['kubernetes', 'k8s', 'helm chart']);
  const nginx = has('infrastructure.nginx') || mentions(corpus, ['nginx', 'reverse proxy']);
  const redis =
    has('infrastructure.redis') || mentions(corpus, ['redis', 'shared cache', 'bullmq production']);
  const demo = mentions(corpus, ['demo mode', 'without paid apis', 'mock provider', 'judged demo']);

  return {
    corpus,
    mappingNames: uniqueSortedNames([...names]),
    searchSimple,
    searchSemantic,
    searchLargeScale,
    jobs: has('jobs') || jobsFromText || automation || eventStreaming,
    eventStreaming,
    microservices: has('architecture.microservices') || mentions(corpus, ['microservice']),
    kubernetes,
    docker,
    redis,
    nginx,
    odoo,
    ai,
    documents,
    notifications,
    email,
    sms,
    otp: has('otp') || mentions(corpus, ['one-time pass', 'otp', '2fa otp']),
    automation,
    scheduler: has('scheduler') || mentions(corpus, ['cron', 'every night', 'scheduled job']),
    reports,
    pdf: has('pdf') || reports,
    copilot,
    intents,
    rag,
    anomaly,
    s3,
    storage,
    webhooks: has('webhooks') || mentions(corpus, ['webhook']),
    dashboard: has('frontend.dashboard') || has('frontend.charts') || mentions(corpus, ['dashboard', 'kpi', 'charts']),
    analytics:
      has('analytics') ||
      mentions(corpus, [
        'time series',
        'timeseries',
        'kpi definition',
        'metric aggregation',
        'analytics dashboard',
        'analytics export',
      ]),
    audit: has('audit') || mentions(corpus, ['audit log', 'who did what']),
    ci: has('infrastructure.github-actions') || mentions(corpus, ['github actions', 'ci/cd']),
    demo,
    realtime: mentions(corpus, ['real-time', 'realtime', 'websocket', 'live updates', 'server-sent', 'sse']),
    offline: mentions(corpus, ['offline', 'resilient', 'unreliable network']),
    pgvector: mentions(corpus, ['pgvector']),
  };
}

export function buildCorpus(input: {
  spec: ProblemIntelligenceSpec;
  mappings: readonly ClassifiedMapping[];
  existingNames: readonly string[];
  newProblemLogic: readonly { requirement: string; logic: string }[];
  unknowns: readonly string[];
  uncertainty: readonly string[];
  problemSummary?: string;
}): string {
  const parts: string[] = [];
  push(parts, input.problemSummary);
  push(parts, input.spec.problemSummary === 'unknown' ? '' : input.spec.problemSummary);
  for (const mapping of input.mappings) {
    push(parts, mapping.requirement, mapping.evidence, mapping.newProblemLogic ?? '');
    if (mapping.existingCapability) {
      push(parts, mapping.existingCapability.name, mapping.existingCapability.summary);
    }
    if (mapping.hallucinatedCapability) {
      push(parts, mapping.hallucinatedCapability);
    }
  }
  for (const name of input.existingNames) {
    push(parts, name);
  }
  for (const item of input.newProblemLogic) {
    push(parts, item.requirement, item.logic);
  }
  parts.push(...input.unknowns, ...input.uncertainty);
  appendSection(parts, input.spec.users);
  appendSection(parts, input.spec.actors);
  appendSection(parts, input.spec.workflows);
  appendSection(parts, input.spec.entities);
  appendSection(parts, input.spec.businessRules);
  appendSection(parts, input.spec.integrations);
  appendSection(parts, input.spec.aiRequirements);
  appendSection(parts, input.spec.automationRequirements);
  appendSection(parts, input.spec.notifications);
  appendSection(parts, input.spec.documents);
  appendSection(parts, input.spec.reports);
  appendSection(parts, input.spec.securityRequirements);
  appendSection(parts, input.spec.nonFunctionalRequirements);
  appendSection(parts, input.spec.likelyDataRequirements);
  appendSection(parts, input.spec.likelyInfrastructureRequirements);
  if (input.spec.odooRequirements.determined) {
    for (const item of input.spec.odooRequirements.items) {
      push(parts, String(item.app), String(item.model), String(item.notes), 'odoo');
    }
  }
  return parts.filter(Boolean).join('\n').toLowerCase();
}

function mentions(corpus: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => corpus.includes(phrase.toLowerCase()));
}

function appendSection(parts: string[], list: UnknownableList<unknown>): void {
  if (!list.determined) {
    return;
  }
  for (const item of list.items) {
    if (item && typeof item === 'object') {
      const record = item as NamedItem & { name?: unknown; description?: unknown; steps?: unknown };
      push(parts, stringifyUnknown(record.name), stringifyUnknown(record.description));
      if (Array.isArray(record.steps)) {
        for (const step of record.steps) {
          push(parts, stringifyUnknown(step));
        }
      }
    } else {
      push(parts, stringifyUnknown(item));
    }
  }
}

function stringifyUnknown(value: unknown): string {
  if (typeof value !== 'string' || isUnknown(value)) {
    return '';
  }
  return value;
}

function push(parts: string[], ...values: Array<string | null | undefined>): void {
  for (const value of values) {
    if (value && !isUnknown(value)) {
      parts.push(value);
    }
  }
}
