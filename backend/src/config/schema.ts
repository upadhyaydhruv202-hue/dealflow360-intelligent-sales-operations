import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const booleanEnv = z.preprocess((value) => {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return value;
}, z.boolean().optional());

const optionalString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string().optional());

export const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  HOST: z.string().min(1).default('0.0.0.0'),
  APP_NAME: z.string().min(1).default('Hackathon Starter Kit'),
  APP_URL: z.string().min(1).default('http://localhost:5000'),
  FRONTEND_URL: z.string().min(1).default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  REQUEST_BODY_LIMIT: z.string().min(1).default('1mb'),

  DATABASE_URL: optionalString,
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_POOL_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(120).default(10),
  REDIS_URL: optionalString,
  JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(3),
  JOB_BACKOFF_MS: z.coerce.number().int().min(0).max(60_000).default(200),
  JOB_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(15 * 60_000)
    .default(60_000),

  JWT_ACCESS_SECRET: optionalString,
  JWT_REFRESH_SECRET: optionalString,
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
  JWT_ISSUER: z.string().min(1).default('hackathon-starter-kit'),
  JWT_AUDIENCE: z.string().min(1).default('hackathon-starter-kit-api'),

  AUTH_PASSWORD_MIN_LENGTH: z.coerce.number().int().min(1).max(72).default(8),
  AUTH_PASSWORD_MAX_LENGTH: z.coerce.number().int().min(8).max(72).default(72),
  AUTH_PASSWORD_REQUIRE_UPPERCASE: booleanEnv,
  AUTH_PASSWORD_REQUIRE_LOWERCASE: booleanEnv,
  AUTH_PASSWORD_REQUIRE_NUMBER: booleanEnv,
  AUTH_PASSWORD_REQUIRE_SPECIAL: booleanEnv,
  AUTH_BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  AUTH_DEFAULT_ROLE: z.string().min(1).default('user'),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(5),
  AUTH_LOGIN_IP_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(20),
  AUTH_LOGIN_RATE_LIMIT_WINDOW: z.string().min(1).default('15m'),
  AUTH_COOKIE_ENABLED: booleanEnv,
  AUTH_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: optionalString,

  ODOO_ENABLED: booleanEnv,
  ODOO_BASE_URL: optionalString,
  ODOO_DATABASE: optionalString,
  ODOO_API_KEY: optionalString,
  ODOO_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(15_000),
  ODOO_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  ODOO_RETRY_BASE_MS: z.coerce.number().int().min(0).max(10_000).default(200),

  AI_ENABLED: booleanEnv,
  AI_PROVIDER: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const trimmed = value.trim().toLowerCase();
      return trimmed === '' ? undefined : trimmed;
    },
    z.enum(['gemini', 'mock']).default('gemini'),
  ),
  AI_MODEL: optionalString,
  GEMINI_API_KEY: optionalString,
  AI_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(30_000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(32_768).default(4096),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_RETRY_BASE_MS: z.coerce.number().int().min(0).max(10_000).default(200),

  EMAIL_ENABLED: booleanEnv,
  EMAIL_PROVIDER: z.enum(['smtp', 'resend', 'brevo', 'mock']).default('smtp'),
  EMAIL_FROM: optionalString,
  EMAIL_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: optionalString,
  RESEND_API_KEY: optionalString,
  BREVO_API_KEY: optionalString,

  SMS_ENABLED: booleanEnv,
  SMS_PROVIDER: z.enum(['mock', 'http']).default('mock'),
  SMS_API_KEY: optionalString,
  SMS_FROM: optionalString,
  SMS_HTTP_URL: optionalString,
  SMS_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),

  STORAGE_PROVIDER: z.enum(['local', 's3', 'postgres']).default('local'),
  STORAGE_LOCAL_DIR: z.string().min(1).default('storage'),
  STORAGE_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024)
    .default(10 * 1024 * 1024),
  STORAGE_SIGNED_URL_EXPIRES: z.coerce.number().int().positive().max(86_400).default(300),
  DOCUMENT_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024)
    .default(10 * 1024 * 1024),
  DOCUMENT_MAX_TEXT_CHARS: z.coerce.number().int().positive().max(500_000).default(100_000),
  DOCUMENT_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  DOCUMENT_ASYNC_THRESHOLD_BYTES: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(50 * 1024 * 1024)
    .default(1 * 1024 * 1024),
  AWS_REGION: optionalString,
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  AWS_S3_BUCKET: optionalString,

  CORS_ORIGINS: z.string().min(1).default('http://localhost:5173'),
  RATE_LIMIT_ENABLED: booleanEnv,
  RATE_LIMIT_FAIL_CLOSED: booleanEnv,
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).max(10_000).default(20),
  RATE_LIMIT_AUTH_WINDOW: z.string().min(1).default('15m'),
  RATE_LIMIT_AI_MAX: z.coerce.number().int().min(1).max(10_000).default(20),
  RATE_LIMIT_AI_WINDOW: z.string().min(1).default('1m'),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().min(1).max(10_000).default(10),
  RATE_LIMIT_UPLOAD_WINDOW: z.string().min(1).default('15m'),
  RATE_LIMIT_PUBLIC_MAX: z.coerce.number().int().min(1).max(10_000).default(60),
  RATE_LIMIT_PUBLIC_WINDOW: z.string().min(1).default('1m'),
  RATE_LIMIT_AUTHENTICATED_MAX: z.coerce.number().int().min(1).max(10_000).default(120),
  RATE_LIMIT_AUTHENTICATED_WINDOW: z.string().min(1).default('1m'),
  RATE_LIMIT_ADMIN_MAX: z.coerce.number().int().min(1).max(10_000).default(30),
  RATE_LIMIT_ADMIN_WINDOW: z.string().min(1).default('1m'),
  AUTH_PASSWORD_RESET_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(5),
  AUTH_PASSWORD_RESET_IP_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(20),
  AUTH_PASSWORD_RESET_RATE_LIMIT_WINDOW: z.string().min(1).default('15m'),
  DEMO_MODE: booleanEnv,

  SCHEDULER_ENABLED: booleanEnv,
  SCHEDULER_INTERVAL: z.string().min(1).default('1m'),
  SCHEDULER_POLL: z.string().min(1).default('1s'),

  FEATURE_AI: booleanEnv,
  FEATURE_ODOO: booleanEnv,
  FEATURE_AUTOMATION: booleanEnv,
  FEATURE_NOTIFICATIONS: booleanEnv,
  OTP_PROVIDER: z.enum(['auto', 'mock']).default('auto'),
  OTP_DIGITS: z.coerce.number().int().min(4).max(8).default(6),
  OTP_TTL: z.string().min(1).default('10m'),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  OTP_RESEND_COOLDOWN: z.string().min(1).default('60s'),
  OTP_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(5),
  OTP_IP_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(20),
  OTP_RATE_LIMIT_WINDOW: z.string().min(1).default('15m'),
  OTP_HASH_SECRET: optionalString,

  FEATURE_OTP: booleanEnv,
  FEATURE_SMS: booleanEnv,
  FEATURE_S3: booleanEnv,
  FEATURE_RAG: booleanEnv,
  FEATURE_COPILOT: booleanEnv,
  FEATURE_INTENTS: booleanEnv,
  FEATURE_PROBLEM_INTELLIGENCE: booleanEnv,
  FEATURE_CAPABILITY_RECOMMENDATIONS: booleanEnv,
  FEATURE_PROJECT_PLANNING: booleanEnv,
  FEATURE_PROJECT_GENERATOR: booleanEnv,
  FEATURE_ANOMALY_DETECTION: booleanEnv,
  FEATURE_REALTIME: booleanEnv,
  FEATURE_SEARCH: booleanEnv,
  FEATURE_ANALYTICS: booleanEnv,
  FEATURE_PDF: booleanEnv,

  SEARCH_PROVIDER: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined;
      }
      const trimmed = value.trim().toLowerCase();
      return trimmed === '' ? undefined : trimmed;
    },
    z
      .string()
      .optional()
      .superRefine((value, ctx) => {
        if (!value) {
          return;
        }
        if (value === 'elasticsearch' || value === 'opensearch' || value === 'solr') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              `${value} is not implemented in this phase. Use SEARCH_PROVIDER=postgres (default) or memory. Application services must keep using SearchService so a future adapter can be added without coupling.`,
          });
          return;
        }
        if (value !== 'postgres' && value !== 'memory') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'SEARCH_PROVIDER must be postgres or memory',
          });
        }
      }),
  ),
  SEARCH_FUZZY_THRESHOLD: z.coerce.number().min(0.1).max(0.9).default(0.3),

  ANALYTICS_PROVIDER: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined;
      }
      const trimmed = value.trim().toLowerCase();
      return trimmed === '' ? undefined : trimmed;
    },
    z
      .string()
      .optional()
      .superRefine((value, ctx) => {
        if (!value) {
          return;
        }
        if (
          value === 'clickhouse' ||
          value === 'bigquery' ||
          value === 'snowflake' ||
          value === 'redshift' ||
          value === 'elasticsearch'
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              `${value} is not implemented in this phase. Use ANALYTICS_PROVIDER=postgres (default) or memory. Application services must keep using AnalyticsService so a future adapter can be added without coupling.`,
          });
          return;
        }
        if (value !== 'postgres' && value !== 'memory') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'ANALYTICS_PROVIDER must be postgres or memory',
          });
        }
      }),
  ),
  ANALYTICS_MAX_RANGE_DAYS: z.coerce.number().int().min(1).max(366).default(90),
  ANALYTICS_MAX_SERIES_POINTS: z.coerce.number().int().min(24).max(500).default(366),
  ANALYTICS_MAX_EXPORT_ROWS: z.coerce.number().int().min(10).max(5000).default(1000),

  REALTIME_HEARTBEAT: z.string().min(1).default('15s'),
  REALTIME_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(10_000).default(200),
  REALTIME_MAX_CONNECTIONS_PER_USER: z.coerce.number().int().min(1).max(50).default(5),

  ALLOW_DEMO_IN_PRODUCTION: booleanEnv,
  JOBS_PROCESS: booleanEnv,
  STORAGE_SIGNING_SECRET: optionalString,

  RAG_VECTOR_STORE: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const trimmed = value.trim().toLowerCase();
      return trimmed === '' ? undefined : trimmed;
    },
    z.enum(['memory', 'postgres']).optional(),
  ),
  RAG_CHUNK_SIZE: z.coerce.number().int().min(200).max(4_000).default(800),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(1_000).default(120),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  RAG_MIN_SCORE: z.coerce.number().min(-1).max(1).default(0.28),
  RAG_MAX_CONTEXT_CHARS: z.coerce.number().int().min(1_000).max(100_000).default(12_000),
  RAG_MAX_DOCUMENT_CHARS: z.coerce.number().int().min(1_000).max(500_000).default(100_000),
  RAG_MAX_CHUNKS_PER_DOCUMENT: z.coerce.number().int().min(1).max(1_000).default(200),
  RAG_ASYNC_THRESHOLD_CHARS: z.coerce.number().int().min(0).max(500_000).default(20_000),

  ANOMALY_ZSCORE_MIN_SAMPLES: z.coerce.number().int().min(2).max(200).default(8),
  ANOMALY_ZSCORE_THRESHOLD: z.coerce.number().min(0).max(20).default(2),
  ANOMALY_ZSCORE_HIGH: z.coerce.number().min(0).max(20).default(3),
  ANOMALY_PERCENT_CHANGE_LOW: z.coerce.number().min(0).max(1000).default(10),
  ANOMALY_PERCENT_CHANGE_MEDIUM: z.coerce.number().min(0).max(1000).default(15),
  ANOMALY_PERCENT_CHANGE_HIGH: z.coerce.number().min(0).max(1000).default(20),
  ANOMALY_MOVING_AVERAGE_WINDOW: z.coerce.number().int().min(2).max(100).default(5),
  ANOMALY_MOVING_AVERAGE_DEVIATION_PCT: z.coerce.number().min(0).max(1000).default(15),
  ANOMALY_TREND_WINDOW: z.coerce.number().int().min(2).max(100).default(5),
  ANOMALY_MAX_POINTS: z.coerce.number().int().min(2).max(5_000).default(500),
  ANOMALY_EXPLAIN: booleanEnv,
});

export type EnvInput = z.input<typeof envSchema>;
export type ParsedEnv = z.output<typeof envSchema>;
