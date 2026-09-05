import { FEATURE_REGISTRY, type FeatureMap } from '../features/registry';
import { resolveDemoMode } from '../features/demo';
import { parseDurationToMs } from '../lib/duration';
import { parseTrustProxy } from '../security/trust-proxy';
import { parseConfig } from '../schemas/parse';
import type { AppConfig } from '../types/config';
import { envSchema, type ParsedEnv } from './schema';

const MIN_PRODUCTION_SECRET_LENGTH = 32;

function bool(value: boolean | undefined, defaultValue: boolean): boolean {
  return value === undefined ? defaultValue : value;
}

function parseCorsOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.some((origin) => origin === '*')) {
    throw new Error('CORS_ORIGINS cannot include * while credentialed requests are enabled');
  }

  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`CORS origin "${origin}" must use http or https`);
      }
      if (parsed.pathname !== '/' && parsed.pathname !== '') {
        throw new Error(`CORS origin "${origin}" must not include a path`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('CORS')) {
        throw error;
      }
      throw new Error(`CORS origin "${origin}" is not a valid origin URL`);
    }
  }

  return origins;
}

function collectProductionSecretErrors(env: ParsedEnv): string[] {
  const missing: string[] = [];

  if (!env.JWT_ACCESS_SECRET) {
    missing.push('JWT_ACCESS_SECRET is required in production');
  } else if (env.JWT_ACCESS_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
    missing.push(`JWT_ACCESS_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters`);
  }

  if (!env.JWT_REFRESH_SECRET) {
    missing.push('JWT_REFRESH_SECRET is required in production');
  } else if (env.JWT_REFRESH_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
    missing.push(`JWT_REFRESH_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters`);
  }

  if (env.AUTH_BCRYPT_COST < 10) {
    missing.push('AUTH_BCRYPT_COST must be at least 10 in production');
  }

  if (!env.DATABASE_URL) {
    missing.push('DATABASE_URL is required in production');
  }

  if (!env.REDIS_URL) {
    missing.push('REDIS_URL is required in production');
  }

  if (!env.STORAGE_SIGNING_SECRET) {
    missing.push('STORAGE_SIGNING_SECRET is required in production');
  } else if (env.STORAGE_SIGNING_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
    missing.push(`STORAGE_SIGNING_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters`);
  }

  const otpEnabled = bool(env.FEATURE_OTP, false);
  if (otpEnabled) {
    if (!env.OTP_HASH_SECRET) {
      missing.push('OTP_HASH_SECRET is required in production when OTP is enabled');
    } else if (env.OTP_HASH_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
      missing.push(`OTP_HASH_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters`);
    }
    if (env.OTP_PROVIDER === 'mock' && !bool(env.DEMO_MODE, false)) {
      missing.push('OTP_PROVIDER=mock is only allowed in production when DEMO_MODE=true');
    }
  }

  if (bool(env.DEMO_MODE, false) && !bool(env.ALLOW_DEMO_IN_PRODUCTION, false)) {
    missing.push(
      'DEMO_MODE is not allowed in production unless ALLOW_DEMO_IN_PRODUCTION=true',
    );
  }

  const corsOrigins = env.CORS_ORIGINS.split(',').map((item) => item.trim());
  if (corsOrigins.includes('*')) {
    missing.push('CORS_ORIGINS cannot be * in production');
  }

  const odooEnabled = bool(env.ODOO_ENABLED, false) || bool(env.FEATURE_ODOO, false);
  if (odooEnabled) {
    if (!env.ODOO_BASE_URL) missing.push('ODOO_BASE_URL is required when Odoo is enabled');
    if (!env.ODOO_DATABASE) missing.push('ODOO_DATABASE is required when Odoo is enabled');
    if (!env.ODOO_API_KEY) missing.push('ODOO_API_KEY is required when Odoo is enabled');
  }

  const aiEnabled = bool(env.AI_ENABLED, false) || bool(env.FEATURE_AI, false);
  if (aiEnabled) {
    if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
      missing.push('GEMINI_API_KEY is required when AI is enabled with the Gemini provider');
    }

    if (env.AI_PROVIDER === 'mock' && !bool(env.DEMO_MODE, false)) {
      missing.push('AI_PROVIDER=mock is only allowed in production when DEMO_MODE=true');
    }
  }

  if (bool(env.EMAIL_ENABLED, false)) {
    const from = env.EMAIL_FROM ?? env.SMTP_FROM;
    if (!from) missing.push('EMAIL_FROM or SMTP_FROM is required when email is enabled');

    if (env.EMAIL_PROVIDER === 'smtp') {
      if (!env.SMTP_HOST)
        missing.push('SMTP_HOST is required when the SMTP email provider is enabled');
    }
    if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
      missing.push('RESEND_API_KEY is required when the Resend email provider is enabled');
    }
    if (env.EMAIL_PROVIDER === 'brevo' && !env.BREVO_API_KEY) {
      missing.push('BREVO_API_KEY is required when the Brevo email provider is enabled');
    }
    if (env.EMAIL_PROVIDER === 'mock' && !bool(env.DEMO_MODE, false)) {
      missing.push('EMAIL_PROVIDER=mock is only allowed in production when DEMO_MODE=true');
    }
  }

  const smsEnabled = bool(env.SMS_ENABLED, false) || bool(env.FEATURE_SMS, false);
  if (smsEnabled) {
    if (env.SMS_PROVIDER === 'http') {
      if (!env.SMS_HTTP_URL)
        missing.push('SMS_HTTP_URL is required when the HTTP SMS provider is enabled');
      if (!env.SMS_API_KEY)
        missing.push('SMS_API_KEY is required when the HTTP SMS provider is enabled');
    }
    if (env.SMS_PROVIDER === 'mock' && !bool(env.DEMO_MODE, false)) {
      missing.push('SMS_PROVIDER=mock is only allowed in production when DEMO_MODE=true');
    }
  }

  const s3Enabled = env.STORAGE_PROVIDER === 's3' || bool(env.FEATURE_S3, false);
  if (s3Enabled) {
    if (!env.AWS_ACCESS_KEY_ID)
      missing.push('AWS_ACCESS_KEY_ID is required when S3 storage is enabled');
    if (!env.AWS_SECRET_ACCESS_KEY) {
      missing.push('AWS_SECRET_ACCESS_KEY is required when S3 storage is enabled');
    }
    if (!env.AWS_S3_BUCKET) missing.push('AWS_S3_BUCKET is required when S3 storage is enabled');
  }

  return missing;
}

function collectDatabaseAuthErrors(env: ParsedEnv): string[] {
  if (env.NODE_ENV === 'test' || !env.DATABASE_URL) {
    return [];
  }

  const missing: string[] = [];
  if (!env.JWT_ACCESS_SECRET) {
    missing.push('JWT_ACCESS_SECRET is required when DATABASE_URL is set');
  }
  if (!env.JWT_REFRESH_SECRET) {
    missing.push('JWT_REFRESH_SECRET is required when DATABASE_URL is set');
  }
  return missing;
}

export function assertProductionSecrets(env: ParsedEnv): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const errors = collectProductionSecretErrors(env);
  if (errors.length === 0) {
    return;
  }

  throw new Error(
    `Invalid production configuration:\n${errors.map((item) => `  - ${item}`).join('\n')}`,
  );
}

export function assertRuntimeAuthSecrets(env: ParsedEnv): void {
  const errors = collectDatabaseAuthErrors(env);
  if (errors.length === 0) {
    return;
  }

  throw new Error(`Invalid configuration:\n${errors.map((item) => `  - ${item}`).join('\n')}`);
}

function resolveFeatures(env: ParsedEnv): FeatureMap {
  return {
    ai: bool(env.AI_ENABLED, false) || bool(env.FEATURE_AI, FEATURE_REGISTRY.ai.default),
    odoo: bool(env.ODOO_ENABLED, false) || bool(env.FEATURE_ODOO, FEATURE_REGISTRY.odoo.default),
    automation: bool(env.FEATURE_AUTOMATION, FEATURE_REGISTRY.automation.default),
    notifications: bool(env.FEATURE_NOTIFICATIONS, FEATURE_REGISTRY.notifications.default),
    otp: bool(env.FEATURE_OTP, FEATURE_REGISTRY.otp.default),
    sms: bool(env.SMS_ENABLED, false) || bool(env.FEATURE_SMS, FEATURE_REGISTRY.sms.default),
    s3: env.STORAGE_PROVIDER === 's3' || bool(env.FEATURE_S3, FEATURE_REGISTRY.s3.default),
    rag: bool(env.FEATURE_RAG, FEATURE_REGISTRY.rag.default),
    copilot: bool(env.FEATURE_COPILOT, FEATURE_REGISTRY.copilot.default),
    intents: bool(env.FEATURE_INTENTS, FEATURE_REGISTRY.intents.default),
    problemIntelligence: bool(
      env.FEATURE_PROBLEM_INTELLIGENCE,
      FEATURE_REGISTRY.problemIntelligence.default,
    ),
    capabilityRecommendations: bool(
      env.FEATURE_CAPABILITY_RECOMMENDATIONS,
      FEATURE_REGISTRY.capabilityRecommendations.default,
    ),
    projectPlanning: bool(
      env.FEATURE_PROJECT_PLANNING,
      FEATURE_REGISTRY.projectPlanning.default,
    ),
    projectGenerator: bool(
      env.FEATURE_PROJECT_GENERATOR,
      FEATURE_REGISTRY.projectGenerator.default,
    ),
    anomalyDetection: bool(
      env.FEATURE_ANOMALY_DETECTION,
      FEATURE_REGISTRY.anomalyDetection.default,
    ),
    realtime: bool(env.FEATURE_REALTIME, FEATURE_REGISTRY.realtime.default),
    search: bool(env.FEATURE_SEARCH, FEATURE_REGISTRY.search.default),
    analytics: bool(env.FEATURE_ANALYTICS, FEATURE_REGISTRY.analytics.default),
    pdf: bool(env.FEATURE_PDF, FEATURE_REGISTRY.pdf.default),
  };
}

export function mapConfig(env: ParsedEnv): AppConfig {
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    requestBodyLimit: env.REQUEST_BODY_LIMIT,
    app: {
      name: env.APP_NAME,
      url: env.APP_URL,
      frontendUrl: env.FRONTEND_URL,
    },
    databaseUrl: env.DATABASE_URL,
    databasePoolMax: env.DATABASE_POOL_MAX,
    databasePoolTimeoutSeconds: env.DATABASE_POOL_TIMEOUT_SECONDS,
    redisUrl: env.REDIS_URL,
    jobs: {
      maxAttempts: env.JOB_MAX_ATTEMPTS,
      backoffMs: env.JOB_BACKOFF_MS,
      timeoutMs: env.JOB_TIMEOUT_MS,
      process: bool(env.JOBS_PROCESS, true),
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    },
    auth: {
      password: {
        minLength: env.AUTH_PASSWORD_MIN_LENGTH,
        maxLength: Math.max(env.AUTH_PASSWORD_MAX_LENGTH, env.AUTH_PASSWORD_MIN_LENGTH),
        requireUppercase: bool(env.AUTH_PASSWORD_REQUIRE_UPPERCASE, false),
        requireLowercase: bool(env.AUTH_PASSWORD_REQUIRE_LOWERCASE, false),
        requireNumber: bool(env.AUTH_PASSWORD_REQUIRE_NUMBER, false),
        requireSpecial: bool(env.AUTH_PASSWORD_REQUIRE_SPECIAL, false),
        bcryptCost: env.AUTH_BCRYPT_COST,
      },
      defaultRole: env.AUTH_DEFAULT_ROLE.trim().toLowerCase(),
      loginRateLimitMax: env.AUTH_LOGIN_RATE_LIMIT_MAX,
      loginIpRateLimitMax: env.AUTH_LOGIN_IP_RATE_LIMIT_MAX,
      loginRateLimitWindowMs: parseDurationToMs(env.AUTH_LOGIN_RATE_LIMIT_WINDOW),
      cookie: {
        enabled: bool(env.AUTH_COOKIE_ENABLED, true),
        sameSite: env.AUTH_COOKIE_SAMESITE,
      },
    },
    odoo: {
      enabled: bool(env.ODOO_ENABLED, false) || bool(env.FEATURE_ODOO, false),
      baseUrl: env.ODOO_BASE_URL,
      database: env.ODOO_DATABASE,
      apiKey: env.ODOO_API_KEY,
      timeoutMs: env.ODOO_TIMEOUT_MS,
      maxRetries: env.ODOO_MAX_RETRIES,
      retryBaseMs: env.ODOO_RETRY_BASE_MS,
    },
    ai: {
      enabled: bool(env.AI_ENABLED, false) || bool(env.FEATURE_AI, false),
      provider: env.AI_PROVIDER,
      model: env.AI_MODEL,
      geminiApiKey: env.GEMINI_API_KEY,
      timeoutMs: env.AI_TIMEOUT_MS,
      maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
      temperature: env.AI_TEMPERATURE,
      maxRetries: env.AI_MAX_RETRIES,
      retryBaseMs: env.AI_RETRY_BASE_MS,
    },
    email: {
      enabled: bool(env.EMAIL_ENABLED, false),
      provider: env.EMAIL_PROVIDER,
      from: env.EMAIL_FROM ?? env.SMTP_FROM,
      timeoutMs: env.EMAIL_TIMEOUT_MS,
      smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
        from: env.EMAIL_FROM ?? env.SMTP_FROM,
      },
      resend: {
        apiKey: env.RESEND_API_KEY,
      },
      brevo: {
        apiKey: env.BREVO_API_KEY,
      },
    },
    sms: {
      enabled: bool(env.SMS_ENABLED, false) || bool(env.FEATURE_SMS, false),
      provider: env.SMS_PROVIDER,
      apiKey: env.SMS_API_KEY,
      from: env.SMS_FROM,
      httpUrl: env.SMS_HTTP_URL,
      timeoutMs: env.SMS_TIMEOUT_MS,
    },
    storage: {
      provider: env.STORAGE_PROVIDER,
      localDir: env.STORAGE_LOCAL_DIR,
      maxBytes: env.STORAGE_MAX_BYTES,
      signedUrlExpiresSeconds: env.STORAGE_SIGNED_URL_EXPIRES,
      signingSecret: env.STORAGE_SIGNING_SECRET,
      aws: {
        region: env.AWS_REGION,
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        bucket: env.AWS_S3_BUCKET,
      },
    },
    documents: {
      maxBytes: env.DOCUMENT_MAX_BYTES,
      maxTextChars: env.DOCUMENT_MAX_TEXT_CHARS,
      confidenceThreshold: env.DOCUMENT_CONFIDENCE_THRESHOLD,
      asyncThresholdBytes: env.DOCUMENT_ASYNC_THRESHOLD_BYTES,
    },
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    rateLimitEnabled: bool(env.RATE_LIMIT_ENABLED, true),
    rateLimits: {
      failClosed: bool(env.RATE_LIMIT_FAIL_CLOSED, env.NODE_ENV === 'production'),
      authentication: {
        max: env.RATE_LIMIT_AUTH_MAX,
        windowMs: parseDurationToMs(env.RATE_LIMIT_AUTH_WINDOW),
      },
      ai: {
        max: env.RATE_LIMIT_AI_MAX,
        windowMs: parseDurationToMs(env.RATE_LIMIT_AI_WINDOW),
      },
      fileUpload: {
        max: env.RATE_LIMIT_UPLOAD_MAX,
        windowMs: parseDurationToMs(env.RATE_LIMIT_UPLOAD_WINDOW),
      },
      publicApi: {
        max: env.RATE_LIMIT_PUBLIC_MAX,
        windowMs: parseDurationToMs(env.RATE_LIMIT_PUBLIC_WINDOW),
      },
      authenticatedApi: {
        max: env.RATE_LIMIT_AUTHENTICATED_MAX,
        windowMs: parseDurationToMs(env.RATE_LIMIT_AUTHENTICATED_WINDOW),
      },
      adminApi: {
        max: env.RATE_LIMIT_ADMIN_MAX,
        windowMs: parseDurationToMs(env.RATE_LIMIT_ADMIN_WINDOW),
      },
      passwordReset: {
        max: env.AUTH_PASSWORD_RESET_RATE_LIMIT_MAX,
        ipMax: env.AUTH_PASSWORD_RESET_IP_RATE_LIMIT_MAX,
        windowMs: parseDurationToMs(env.AUTH_PASSWORD_RESET_RATE_LIMIT_WINDOW),
      },
    },
    demoMode: resolveDemoMode(env),
    scheduler: {
      enabled: bool(env.SCHEDULER_ENABLED, bool(env.FEATURE_AUTOMATION, false)),
      intervalMs: parseDurationToMs(env.SCHEDULER_INTERVAL),
      pollMs: parseDurationToMs(env.SCHEDULER_POLL),
    },
    otp: {
      enabled: bool(env.FEATURE_OTP, false),
      provider: env.OTP_PROVIDER,
      digits: env.OTP_DIGITS,
      ttlMs: parseDurationToMs(env.OTP_TTL),
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      resendCooldownMs: parseDurationToMs(env.OTP_RESEND_COOLDOWN),
      destinationRateLimitMax: env.OTP_RATE_LIMIT_MAX,
      ipRateLimitMax: env.OTP_IP_RATE_LIMIT_MAX,
      rateLimitWindowMs: parseDurationToMs(env.OTP_RATE_LIMIT_WINDOW),
      hashSecret: env.OTP_HASH_SECRET ?? 'dev-otp-hash-secret-not-for-production',
    },
    rag: {
      vectorStore: env.RAG_VECTOR_STORE ?? (env.DATABASE_URL ? 'postgres' : 'memory'),
      chunkSize: env.RAG_CHUNK_SIZE,
      chunkOverlap: Math.min(env.RAG_CHUNK_OVERLAP, env.RAG_CHUNK_SIZE - 1),
      topK: env.RAG_TOP_K,
      minScore: env.RAG_MIN_SCORE,
      maxContextChars: env.RAG_MAX_CONTEXT_CHARS,
      maxDocumentChars: env.RAG_MAX_DOCUMENT_CHARS,
      maxChunksPerDocument: env.RAG_MAX_CHUNKS_PER_DOCUMENT,
      asyncThresholdChars: env.RAG_ASYNC_THRESHOLD_CHARS,
    },
    anomaly: {
      zScoreMinSamples: env.ANOMALY_ZSCORE_MIN_SAMPLES,
      zScoreThreshold: env.ANOMALY_ZSCORE_THRESHOLD,
      zScoreHigh: env.ANOMALY_ZSCORE_HIGH,
      percentChangeLow: env.ANOMALY_PERCENT_CHANGE_LOW,
      percentChangeMedium: env.ANOMALY_PERCENT_CHANGE_MEDIUM,
      percentChangeHigh: env.ANOMALY_PERCENT_CHANGE_HIGH,
      movingAverageWindow: env.ANOMALY_MOVING_AVERAGE_WINDOW,
      movingAverageDeviationPct: env.ANOMALY_MOVING_AVERAGE_DEVIATION_PCT,
      trendWindow: env.ANOMALY_TREND_WINDOW,
      maxPoints: env.ANOMALY_MAX_POINTS,
      explain: bool(env.ANOMALY_EXPLAIN, true),
    },
    realtime: {
      heartbeatMs: parseDurationToMs(env.REALTIME_HEARTBEAT),
      maxConnections: env.REALTIME_MAX_CONNECTIONS,
      maxConnectionsPerUser: env.REALTIME_MAX_CONNECTIONS_PER_USER,
    },
    search: {
      provider:
        env.SEARCH_PROVIDER === 'postgres' || env.SEARCH_PROVIDER === 'memory'
          ? env.SEARCH_PROVIDER
          : env.DATABASE_URL
            ? 'postgres'
            : 'memory',
      fuzzyThreshold: env.SEARCH_FUZZY_THRESHOLD,
    },
    analytics: {
      provider:
        env.ANALYTICS_PROVIDER === 'postgres' || env.ANALYTICS_PROVIDER === 'memory'
          ? env.ANALYTICS_PROVIDER
          : env.DATABASE_URL
            ? 'postgres'
            : 'memory',
      maxRangeDays: env.ANALYTICS_MAX_RANGE_DAYS,
      maxSeriesPoints: env.ANALYTICS_MAX_SERIES_POINTS,
      maxExportRows: env.ANALYTICS_MAX_EXPORT_ROWS,
    },
    features: resolveFeatures(env),
  };
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = parseConfig(envSchema, source);
  assertProductionSecrets(parsed);
  assertRuntimeAuthSecrets(parsed);
  return mapConfig(parsed);
}

let cachedConfig: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }

  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = undefined;
}
