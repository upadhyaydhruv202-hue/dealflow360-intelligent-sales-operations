import { PAGINATION as CONTRACT_PAGINATION } from '@hackathon/api-contract';

export {
  API_PATHS,
  API_PREFIX,
  API_ROUTE_PATHS,
  API_VERSION,
  ERROR_CODES,
  OPERATIONAL_PATHS,
  PAGINATION,
  REQUEST_ID,
} from '@hackathon/api-contract';
export type { ErrorCode } from '@hackathon/api-contract';

export const FILTER_OPERATORS = ['eq', 'neq', 'contains', 'in', 'gte', 'lte'] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const UPLOAD = {
  MAX_BYTES: 10 * 1024 * 1024,
  MAX_FILENAME_LENGTH: 255,
} as const;

export const STORAGE = {
  MAX_BYTES: UPLOAD.MAX_BYTES,
  MAX_FILENAME_LENGTH: UPLOAD.MAX_FILENAME_LENGTH,
  SIGNED_URL_DEFAULT_SECONDS: 300,
  SIGNED_URL_MAX_SECONDS: 86_400,
} as const;

export const STORAGE_PURPOSES = ['attachment', 'avatar', 'export', 'document', 'report'] as const;
export type StoragePurposeName = (typeof STORAGE_PURPOSES)[number];

export const DOCUMENT = {
  MAX_BYTES: UPLOAD.MAX_BYTES,
  MAX_FILENAME_LENGTH: UPLOAD.MAX_FILENAME_LENGTH,
  MAX_TEXT_CHARS: 100_000,
  DEFAULT_CONFIDENCE_THRESHOLD: 0.7,
  DEFAULT_ASYNC_THRESHOLD_BYTES: 1 * 1024 * 1024,
  JOB_ATTEMPTS: 3,
  JOB_BACKOFF_MS: 0,
} as const;

export const REPORTS = {
  JOB_ATTEMPTS: 3,
  JOB_BACKOFF_MS: 200,
  JOB_TIMEOUT_MS: 60_000,
  MAX_TABLE_ROWS: 200,
  MAX_TABLE_COLUMNS: 12,
  MAX_CHART_POINTS: 24,
  MAX_FACT_KEYS: 40,
  MAX_SECTIONS: 30,
  MAX_SECTION_LINES: 80,
  MAX_NARRATIVE_CHARS: 8_000,
  EMAIL_ATTACH_MAX_BYTES: 1_000_000,
  SIGNED_URL_SECONDS: STORAGE.SIGNED_URL_MAX_SECONDS,
} as const;

export const REPORT_TYPES = ['simple', 'table', 'summary', 'document'] as const;
export type ReportTypeName = (typeof REPORT_TYPES)[number];

export const JOBS = {
  QUEUE_NAME: 'hackathon',
  FILE_DIR: 'job-queue',
  FILE_POLL_MS: 100,
  DEFAULT_ATTEMPTS: 3,
  DEFAULT_BACKOFF_MS: 200,
  DEFAULT_TIMEOUT_MS: 60_000,
  STATUS_TTL_MS: 24 * 60 * 60 * 1000,
  IDEMPOTENCY_TTL_MS: 24 * 60 * 60 * 1000,
  OTP_TTL_MS: 10 * 60 * 1000,
  OTP_DEFAULT_DIGITS: 6,
  OTP_MIN_DIGITS: 4,
  OTP_MAX_DIGITS: 8,
  OTP_MAX_ATTEMPTS: 5,
  OTP_RESEND_COOLDOWN_MS: 60_000,
  CACHE_DEFAULT_TTL_MS: 60_000,
} as const;

export const JOB_NAMES = {
  EMAIL_SEND: 'email.send',
  SMS_SEND: 'sms.send',
  PDF_GENERATE: 'pdf.generate',
  AI_ANALYZE: 'ai.analyze',
  DOCUMENT_ANALYZE: 'document.analyze',
  DOCUMENT_PROCESS: 'document.process',
  RAG_INDEX: 'rag.index',
  ANOMALY_EVALUATE: 'anomaly.evaluate',
  ODOO_SYNC: 'odoo.sync',
  REPORT_GENERATE: 'report.generate',
  CLEANUP: 'cleanup',
  NOTIFICATION_DISPATCH: 'notification.dispatch',
  AUTOMATION_EXECUTE: 'automation.execute',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export const JOB_STATUSES = ['queued', 'processing', 'completed', 'failed', 'retrying'] as const;
export type JobStatusName = (typeof JOB_STATUSES)[number];

export const REALTIME = {
  HEARTBEAT_MS: 15_000,
  MAX_CONNECTIONS: 200,
  MAX_CONNECTIONS_PER_USER: 5,
  REDIS_CHANNEL: 'hackathon:realtime',
} as const;

export const REALTIME_CHANNELS = [
  'jobs',
  'notifications',
  'dashboard',
  'automation',
  'documents',
] as const;
export type RealtimeChannelName = (typeof REALTIME_CHANNELS)[number];

export const COPILOT = {
  MAX_MESSAGE_CHARS: 8_000,
  MAX_HISTORY_MESSAGES: 20,
  MAX_HISTORY_CHARS: 2_000,
  MAX_TOOLS_PER_TURN: 3,
  MAX_RESULT_CHARS: 4_000,
  CONFIRMATION_TTL_MS: 10 * 60 * 1000,
  AUDIT_ACTION: 'copilot.tool',
} as const;

export const INTENTS = {
  MAX_UTTERANCE_CHARS: 4_000,
  CONFIRMATION_TTL_MS: 10 * 60 * 1000,
  AUDIT_ACTION: 'intent.execute',
} as const;

export const PROBLEM_INTELLIGENCE = {
  MAX_STATEMENT_CHARS: 50_000,
  MAX_TITLE_CHARS: 200,
  AUDIT_ACTION: 'problem.intelligence.analyzed',
} as const;

export const CAPABILITY_RECOMMENDATIONS = {
  AUDIT_ACTION: 'capability.recommendations.generated',
} as const;

export const PROJECT_PLANNING = {
  MAX_TITLE_CHARS: 200,
  MAX_CAPABILITIES: 200,
  MAX_PROFILES: 12,
  SCHEMA_VERSION: 1,
  AUDIT_ANALYZE: 'project.planning.analyzed',
  AUDIT_APPROVE: 'project.planning.approved',
} as const;

export const PROJECT_GENERATOR = {
  AUDIT_PREVIEW: 'project.generator.previewed',
  AUDIT_GENERATE: 'project.generator.generated',
} as const;

export const SEARCH_PROVIDERS = ['postgres', 'memory'] as const;
export type SearchProviderName = (typeof SEARCH_PROVIDERS)[number];

export const SEARCH_MODES = ['auto', 'keyword', 'fulltext', 'fuzzy'] as const;
export type SearchModeName = (typeof SEARCH_MODES)[number];

export const SEARCH_RESOLVED_MODES = ['browse', 'keyword', 'fulltext', 'fuzzy'] as const;
export type SearchResolvedModeName = (typeof SEARCH_RESOLVED_MODES)[number];

export const SEARCH = {
  DEFAULT_PROVIDER: 'postgres',
  DEFAULT_PAGE: CONTRACT_PAGINATION.DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE: CONTRACT_PAGINATION.DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE: CONTRACT_PAGINATION.MAX_PAGE_SIZE,
  MAX_QUERY_CHARS: 500,
  MAX_TITLE_CHARS: 300,
  MAX_BODY_CHARS: 20_000,
  MAX_KEYWORDS_CHARS: 2_000,
  MAX_DOCUMENT_ID_CHARS: 128,
  MAX_INDEX_NAME_CHARS: 64,
  MAX_FIELD_NAME_CHARS: 64,
  MAX_FILTERS: 20,
  MAX_TOKENS: 12,
  MAX_TOKEN_CHARS: 64,
  MAX_HIGHLIGHT_CHARS: 220,
  MAX_PAYLOAD_KEYS: 40,
  DEFAULT_FUZZY_THRESHOLD: 0.3,
  MIN_FUZZY_THRESHOLD: 0.1,
  MAX_FUZZY_THRESHOLD: 0.9,
  FUZZY_MAX_TOKENS: 3,
  FUZZY_MIN_TOKEN_CHARS: 3,
  DEMO_INDEX: 'kit.demo',
  AUDIT_INDEX: 'search.index',
  AUDIT_DELETE: 'search.delete',
} as const;

export const ANALYTICS_PROVIDERS = ['postgres', 'memory'] as const;
export type AnalyticsProviderName = (typeof ANALYTICS_PROVIDERS)[number];

export const ANALYTICS_AGGREGATIONS = ['count', 'sum', 'avg', 'min', 'max'] as const;
export type AnalyticsAggregation = (typeof ANALYTICS_AGGREGATIONS)[number];

export const ANALYTICS_GRANULARITIES = ['hour', 'day', 'week', 'month'] as const;
export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];

export const ANALYTICS_QUERY_KINDS = ['snapshot', 'timeseries', 'breakdown'] as const;
export type AnalyticsQueryKind = (typeof ANALYTICS_QUERY_KINDS)[number];

export const ANALYTICS_EXPORT_FORMATS = ['json', 'csv'] as const;
export type AnalyticsExportFormat = (typeof ANALYTICS_EXPORT_FORMATS)[number];

export const ANALYTICS_WIDGET_TYPES = ['kpi', 'timeseries', 'breakdown'] as const;
export type AnalyticsWidgetType = (typeof ANALYTICS_WIDGET_TYPES)[number];

export const ANALYTICS = {
  DEFAULT_PROVIDER: 'postgres',
  DEFAULT_PAGE: CONTRACT_PAGINATION.DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE: CONTRACT_PAGINATION.DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE: CONTRACT_PAGINATION.MAX_PAGE_SIZE,
  DEFAULT_RANGE_DAYS: 7,
  DEFAULT_MAX_RANGE_DAYS: 90,
  MIN_MAX_RANGE_DAYS: 1,
  MAX_MAX_RANGE_DAYS: 366,
  HOUR_MAX_RANGE_DAYS: 14,
  DAY_MAX_RANGE_DAYS: 90,
  WEEK_MAX_RANGE_DAYS: 366,
  MONTH_MAX_RANGE_DAYS: 366,
  DEFAULT_SERIES_POINTS: 366,
  MAX_SERIES_POINTS: 500,
  MIN_SERIES_POINTS: 24,
  DEFAULT_EXPORT_ROWS: 1_000,
  MAX_EXPORT_ROWS: 5_000,
  MAX_INGEST_BATCH: 100,
  MAX_FILTERS: 12,
  MAX_DIMENSIONS: 16,
  MAX_KPI_NAME_CHARS: 64,
  MAX_SOURCE_CHARS: 64,
  MAX_EVENT_ID_CHARS: 128,
  MAX_FIELD_NAME_CHARS: 64,
  MAX_DIMENSION_CHARS: 120,
  MAX_VALUE: 1_000_000_000_000,
  MIN_VALUE: -1_000_000_000_000,
  DEMO_SOURCE: 'kit.demo',
  DEMO_EVENTS_KPI: 'kit.demo.events',
  DEMO_VALUE_KPI: 'kit.demo.value',
  DEMO_DASHBOARD: 'kit.demo',
  AUDIT_INGEST: 'analytics.ingest',
  AUDIT_EXPORT: 'analytics.export',
} as const;

export const RAG = {
  DEFAULT_VECTOR_STORE: 'memory',
  DEFAULT_CHUNK_SIZE: 800,
  DEFAULT_CHUNK_OVERLAP: 120,
  DEFAULT_TOP_K: 5,
  DEFAULT_MIN_SCORE: 0.28,
  MAX_TOP_K: 20,
  MAX_CONTEXT_CHARS: 12_000,
  MAX_DOCUMENT_CHARS: 100_000,
  MAX_CHUNKS_PER_DOCUMENT: 200,
  MAX_QUERY_CHARS: 2_000,
  MAX_ANSWER_CHARS: 8_000,
  MAX_QUOTE_CHARS: 400,
  MAX_SOURCE_CHARS: 256,
  MAX_DOCUMENT_ID_CHARS: 128,
  MAX_CHUNK_ID_CHARS: 160,
  MAX_METADATA_KEYS: 20,
  MAX_SCAN_CHUNKS: 5_000,
  ASYNC_THRESHOLD_CHARS: 20_000,
  LEXICAL_EMBEDDING_DIMENSIONS: 32,
  UNGROUNDED_MAX_CONFIDENCE: 0.35,
  AUDIT_INDEX: 'rag.index',
  AUDIT_ASK: 'rag.ask',
  AUDIT_DELETE: 'rag.delete',
} as const;

export const ANOMALY_SEVERITIES = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const;
export type AnomalySeverityName = (typeof ANOMALY_SEVERITIES)[number];

export const ANOMALY_DETECTORS = [
  'threshold',
  'percentChange',
  'movingAverage',
  'frequency',
  'trend',
  'zScore',
] as const;
export type AnomalyDetectorName = (typeof ANOMALY_DETECTORS)[number];

export const ANOMALY_EXPLANATION_STATUSES = ['generated', 'skipped', 'failed', 'unavailable'] as const;
export type AnomalyExplanationStatusName = (typeof ANOMALY_EXPLANATION_STATUSES)[number];

export const ANOMALY = {
  DEFAULT_ZSCORE_MIN_SAMPLES: 8,
  DEFAULT_ZSCORE_THRESHOLD: 2,
  DEFAULT_ZSCORE_HIGH: 3,
  DEFAULT_PERCENT_CHANGE_LOW: 10,
  DEFAULT_PERCENT_CHANGE_MEDIUM: 15,
  DEFAULT_PERCENT_CHANGE_HIGH: 20,
  DEFAULT_MOVING_AVERAGE_WINDOW: 5,
  DEFAULT_MOVING_AVERAGE_DEVIATION_PCT: 15,
  DEFAULT_TREND_WINDOW: 5,
  DEFAULT_TREND_MIN_SLOPE: 0.5,
  DEFAULT_FREQUENCY_MIN_SAMPLES: 8,
  MAX_POINTS: 500,
  MIN_POINTS: 1,
  MAX_METRIC_CHARS: 64,
  MAX_EXPLANATION_CHARS: 4_000,
  MAX_ACTION_CHARS: 2_000,
  MAX_METADATA_KEYS: 20,
  JOB_ATTEMPTS: 3,
  JOB_BACKOFF_MS: 200,
  AUDIT_EVALUATE: 'anomaly.evaluate',
  EVENT_DETECTED: 'anomaly.detected',
} as const;

export const AI_GUARDRAILS = {
  MAX_INPUT_CHARS: 100_000,
  MAX_SYSTEM_CHARS: 8_000,
  MAX_MESSAGES: 32,
  MAX_RESULT_CHARS: 4_000,
  LOW_CONFIDENCE_THRESHOLD: 0.6,
  AUDIT_GENERATE: 'ai.generate',
  AUDIT_DECISION: 'ai.decision',
  AUDIT_TOOL: 'ai.tool',
  AUDIT_ACTION: 'ai.action',
} as const;

export const AUTOMATION = {
  EXECUTE_JOB: JOB_NAMES.AUTOMATION_EXECUTE,
  JOB_ATTEMPTS: 3,
  JOB_BACKOFF_MS: 50,
  MAX_ACTIONS: 10,
  MAX_CONDITIONS: 20,
  MAX_NAME_CHARS: 120,
  MAX_DESCRIPTION_CHARS: 500,
  MAX_EVENT_ID_CHARS: 128,
  AUDIT_EXECUTE: 'automation.execute',
  AUDIT_RULE: 'automation.rule',
  WEBHOOK_TIMEOUT_MS: 5_000,
} as const;

export const AUDIT = {
  MAX_JSON_CHARS: 4_000,
  MAX_ACTION_CHARS: 128,
  MAX_RESOURCE_CHARS: 64,
  MAX_RESOURCE_ID_CHARS: 128,
  MAX_IP_CHARS: 64,
  MAX_STATUS_CHARS: 64,
} as const;

export const AUDIT_ACTIONS = {
  USER_LOGIN: 'user.login',
  USER_CREATED: 'user.created',
  USER_PASSWORD_RESET: 'user.password_reset',
  ROLE_CREATED: 'rbac.role.created',
  PERMISSION_CREATED: 'rbac.permission.created',
  ROLE_PERMISSION_ASSIGNED: 'rbac.role.permission_assigned',
  USER_ROLE_ASSIGNED: 'rbac.user.role_assigned',
  ODOO_RECORD_CREATED: 'odoo.record.created',
  ODOO_RECORD_UPDATED: 'odoo.record.updated',
  ODOO_RECORD_DELETED: 'odoo.record.deleted',
  ODOO_METHOD_CALLED: 'odoo.method.called',
  AI_ACTION_REQUESTED: AI_GUARDRAILS.AUDIT_GENERATE,
  AI_TOOL_EXECUTED: AI_GUARDRAILS.AUDIT_TOOL,
  INTENT_EXECUTED: INTENTS.AUDIT_ACTION,
  PROBLEM_INTELLIGENCE_ANALYZED: PROBLEM_INTELLIGENCE.AUDIT_ACTION,
  CAPABILITY_RECOMMENDATIONS_GENERATED: CAPABILITY_RECOMMENDATIONS.AUDIT_ACTION,
  PROJECT_PLANNING_ANALYZED: PROJECT_PLANNING.AUDIT_ANALYZE,
  PROJECT_PLANNING_APPROVED: PROJECT_PLANNING.AUDIT_APPROVE,
  PROJECT_GENERATOR_PREVIEWED: PROJECT_GENERATOR.AUDIT_PREVIEW,
  PROJECT_GENERATOR_GENERATED: PROJECT_GENERATOR.AUDIT_GENERATE,
  FILE_UPLOADED: 'file.uploaded',
  FILE_DELETED: 'file.deleted',
  REPORT_GENERATED: 'report.generated',
  NOTIFICATION_SENT: 'notification.sent',
  AUTOMATION_EXECUTED: AUTOMATION.AUDIT_EXECUTE,
  RAG_INDEXED: RAG.AUDIT_INDEX,
  RAG_ASKED: RAG.AUDIT_ASK,
  SEARCH_INDEXED: SEARCH.AUDIT_INDEX,
  SEARCH_DELETED: SEARCH.AUDIT_DELETE,
  ANOMALY_EVALUATED: ANOMALY.AUDIT_EVALUATE,
} as const;

export const AUTOMATION_OPERATORS = [
  'equals',
  'notEquals',
  'greaterThan',
  'lessThan',
  'greaterOrEqual',
  'lessOrEqual',
  'contains',
  'in',
  'exists',
] as const;

export const AUTOMATION_BUILTIN_TRIGGERS = [
  'user.created',
  'order.created',
  'order.updated',
  'invoice.overdue',
  'document.uploaded',
  'report.completed',
  'scheduled',
  'webhook.received',
  'anomaly.detected',
] as const;

export const SCHEDULER = {
  DEFAULT_NAME: 'tick',
  DEFAULT_TRIGGER: 'scheduled',
  NAME_PATTERN: /^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/,
} as const;

export const NOTIFICATION_CHANNELS = ['email', 'in_app', 'sms', 'push', 'webhook'] as const;
export type NotificationChannelName = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export type NotificationPriorityName = (typeof NOTIFICATION_PRIORITIES)[number];

export const NOTIFICATION_CATEGORIES = [
  'order_updates',
  'security_alerts',
  'reports',
  'marketing',
  'system',
] as const;
export type NotificationCategoryName = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_DELIVERY_STATUSES = ['queued', 'processing', 'sent', 'failed', 'retrying'] as const;
export type NotificationDeliveryStatusName = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const NOTIFICATIONS = {
  DISPATCH_JOB: JOB_NAMES.NOTIFICATION_DISPATCH,
  MANDATORY_CATEGORIES: ['security_alerts'] as const,
  HIGH_PRIORITIES: ['high', 'critical'] as const,
  DEFAULT_ATTEMPTS: 3,
  HIGH_ATTEMPTS: 5,
  LOW_ATTEMPTS: 2,
  WEBHOOK_TIMEOUT_MS: 5_000,
  SMS_TIMEOUT_MS: 10_000,
  MAX_TEMPLATE_CHARS: 8_000,
  MAX_DATA_KEYS: 40,
} as const;

export const AUTOMATION_BUILTIN_ACTIONS = [
  'sendEmail',
  'sendNotification',
  'generatePDF',
  'queueAIAnalysis',
  'callOdoo',
  'createAuditLog',
  'enqueueJob',
  'webhook',
  'updateRecord',
] as const;
