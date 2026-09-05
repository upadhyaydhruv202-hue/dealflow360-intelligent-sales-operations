import { createAiService } from '../integrations/ai';
import { createDocumentIntelligenceService } from '../integrations/documents';
import { createRagService } from '../integrations/rag';
import { createSearchService, isSearchEnabled } from '../integrations/search';
import { createAnalyticsService, isAnalyticsEnabled } from '../integrations/analytics';
import { createAnomalyService, isAnomalyEnabled } from '../anomaly';
import { createEmailService } from '../integrations/email';
import { createSmsService } from '../integrations/sms';
import { createOdooCacheFromKv, createOdooService } from '../integrations/odoo';
import { createPdfService } from '../integrations/pdf';
import { createReportService } from '../integrations/reports';
import { createStorageService } from '../integrations/storage';
import { createPlatformCapabilityRegistry, type CapabilityRegistry } from '../capabilities';
import { bindPlatformPlugins, type PlatformPlugin } from '../platform';
import { createDatabaseClient } from '../lib/database';
import { CacheService } from '../lib/cache';
import { IdempotencyStore } from '../lib/idempotency';
import { createKvStore, createRedisClient } from '../lib/redis';
import {
  AuditRepository,
  AutomationRepository,
  DocumentRepository,
  NotificationRepository,
  UserRepository,
  RagRepository,
  AnomalyRepository,
  SearchRepository,
  AnalyticsRepository,
} from '../repositories';
import { AuditService } from '../audit';
import { createAutomationService } from '../automation';
import { createNotificationService } from '../notifications';
import type { Closable } from '../types/lifecycle';
import { isFeatureEnabled } from '../features';
import { createEventBus, eventIdFor } from '../events';
import { createRealtimeService, isRealtimeEnabled, type RealtimeService } from '../realtime';
import { applyProblemModule, createProblemHost, loadProblemModule } from '../problem';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import { registerCleanupJob } from './cleanup';
import { resolveJobsDir } from './paths';
import { createJobQueue, type JobQueue } from './queue';

export interface BackgroundWorker extends Closable {
  readonly jobs: JobQueue;
  readonly capabilities: CapabilityRegistry;
  start(): void;
}

export function createBackgroundWorker(options: {
  config: AppConfig;
  logger: AppLogger;
  plugins?: readonly PlatformPlugin[];
  capabilityRegistry?: CapabilityRegistry;
}): BackgroundWorker {
  const { config, logger } = options;
  const capabilityRegistry = options.capabilityRegistry ?? createPlatformCapabilityRegistry();
  const database = config.databaseUrl
    ? createDatabaseClient({
        url: config.databaseUrl,
        poolMax: config.databasePoolMax,
        poolTimeoutSeconds: config.databasePoolTimeoutSeconds,
      })
    : null;
  const prisma = database?.prisma ?? null;
  const redis = config.redisUrl ? createRedisClient(config.redisUrl) : null;
  const kv = createKvStore(redis, { allowMemory: !config.isProduction });
  const cache = new CacheService(kv);
  const idempotency = new IdempotencyStore(kv);
  const realtime: RealtimeService | null = isRealtimeEnabled(config)
    ? createRealtimeService({
        config,
        logger,
        redisUrl: config.redisUrl,
        subscribeRedis: false,
      })
    : null;
  const jobs = createJobQueue({
    logger,
    redisUrl: config.redisUrl,
    jobsDir: config.redisUrl ? undefined : resolveJobsDir(),
    defaultAttempts: config.jobs.maxAttempts,
    defaultBackoffMs: config.jobs.backoffMs,
    defaultTimeoutMs: config.jobs.timeoutMs,
    processJobs: true,
    onStatus: realtime ? (record) => realtime.publishJob(record) : undefined,
  });
  registerCleanupJob(jobs, kv);
  const audit = prisma ? new AuditService(new AuditRepository(prisma), logger) : undefined;
  const events = createEventBus(logger);
  const storage = createStorageService(config, { prisma, audit });
  const aiService = createAiService({ config, logger, jobs, audit });
  const emailService = createEmailService({ config, logger, jobs, idempotency, ai: aiService });
  const smsService = createSmsService({ config, jobs, idempotency });
  const emitReportCompleted = (event: { key: string; filename: string; title: string; type?: string }) => {
    if (!isFeatureEnabled(config, 'automation')) {
      return;
    }
    void events.emit({
      type: 'report.completed',
      id: eventIdFor('report.completed', event.key),
      payload: { key: event.key, filename: event.filename, title: event.title, type: event.type },
    });
  };
  const pdfService = createPdfService({
    storage,
    jobs,
    onGenerated: emitReportCompleted,
  });
  const odooService = createOdooService({
    config,
    logger,
    cache: createOdooCacheFromKv(cache),
    jobs,
    audit,
  });

  let notificationService = null as ReturnType<typeof createNotificationService> | null;
  let automationService = null as ReturnType<typeof createAutomationService> | null;
  if (prisma) {
    const users = new UserRepository(prisma);
    notificationService = createNotificationService({
      notifications: new NotificationRepository(prisma),
      users,
      email: emailService,
      sms: smsService,
      jobs,
      idempotency,
      config,
      audit,
      onInAppCreated: realtime ? (event) => realtime.publishNotification(event) : undefined,
    });
    createDocumentIntelligenceService({
      config,
      logger,
      documents: new DocumentRepository(prisma),
      storage,
      ai: aiService,
      jobs,
      onAnalyzed: (event) => {
        if (realtime) {
          realtime.publishDocument({
            documentId: event.documentId,
            userId: event.userId,
            status: event.status,
            documentType: event.documentType,
            requiresReview: event.requiresReview,
            confidence: event.confidence,
          });
        }
        if (isFeatureEnabled(config, 'notifications')) {
          void notificationService
            ?.notify({
              userId: event.userId,
              type: event.requiresReview ? 'warning' : 'success',
              title: 'Document analysis finished',
              body: `Your ${event.documentType} document is ${event.status}.`,
            })
            .catch((error: unknown) => {
              logger.warn({ err: error, documentId: event.documentId }, 'Failed to record document notification');
            });
        }
      },
    });
    if (isFeatureEnabled(config, 'automation')) {
      automationService = createAutomationService({
        config,
        logger,
        store: new AutomationRepository(prisma),
        jobs,
        events,
        audit,
        actionDeps: {
          email: emailService,
          notifications: notificationService,
          pdf: pdfService,
          ai: aiService,
          odoo: odooService,
          jobs,
          audit,
        },
        onExecutionUpdated: realtime ? (event) => realtime.publishAutomation(event) : undefined,
      });
    }
  }

  if (isFeatureEnabled(config, 'rag')) {
    createRagService({
      config,
      logger,
      ai: aiService,
      jobs,
      audit,
      ragDocuments: prisma ? new RagRepository(prisma) : null,
    });
  }

  const searchService = isSearchEnabled(config)
    ? createSearchService({
        config,
        logger,
        audit,
        documents: prisma ? new SearchRepository(prisma) : null,
      })
    : null;

  const analyticsService = isAnalyticsEnabled(config)
    ? createAnalyticsService({
        config,
        logger,
        audit,
        facts: prisma ? new AnalyticsRepository(prisma) : null,
      })
    : null;

  if (isAnomalyEnabled(config)) {
    createAnomalyService({
      config,
      logger,
      ai: aiService,
      jobs,
      audit,
      events,
      notifications: notificationService,
      store: prisma ? new AnomalyRepository(prisma) : undefined,
    });
  }

  const reportService = createReportService({
    storage,
    jobs,
    email: emailService,
    notifications: notificationService,
    appName: config.app.name,
    onGenerated: emitReportCompleted,
    audit,
  });

  bindPlatformPlugins({
    plugins: options.plugins,
    role: 'worker',
    config,
    logger,
    jobs,
    events,
    scheduler: null,
    capabilities: capabilityRegistry,
    registries: {
      copilot: null,
      intents: null,
      odooCapabilities: odooService.capabilities,
      automation: automationService?.registries ?? null,
      reports: reportService.getRegistry(),
    },
  });

  applyProblemModule(
    createProblemHost({
      stage: 'worker',
      config,
      logger,
      jobs,
      events,
      prisma,
      capabilities: capabilityRegistry,
      audit,
      reports: reportService.getRegistry(),
      automation: automationService?.registries ?? null,
      ai: aiService,
      odoo: odooService,
      search: searchService,
      analytics: analyticsService,
    }),
    loadProblemModule(),
  );

  return {
    name: 'workers',
    jobs,
    capabilities: capabilityRegistry,
    start() {
      logger.info(
        {
          env: config.nodeEnv,
          redisConfigured: Boolean(config.redisUrl),
          databaseConfigured: Boolean(config.databaseUrl),
          queueBackend: jobs.backend,
        },
        'Workers process started',
      );

      if (jobs.backend === 'memory') {
        logger.warn(
          'Job queue is in-memory; this process cannot share jobs with the API. Unset test mode or set REDIS_URL / use the file queue.',
        );
      }

      if (!database) {
        logger.warn('DATABASE_URL is not set; document.process processors are not registered');
      }
    },
    async close() {
      await jobs.close();
      await realtime?.close();
      await redis?.close();
      await database?.close();
    },
  };
}
