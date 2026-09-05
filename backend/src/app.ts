import type { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express, { type Application, type Express } from 'express';
import helmet from 'helmet';

import { authenticate as createAuthenticate, authenticateOptional as createAuthenticateOptional } from './auth/authenticate';
import { createTokenServiceFromConfig } from './auth/jwt';
import { TokenRevocationStore } from './auth/token-revocation';
import { createLoginRateLimit } from './auth/login-rate-limit';
import { createPasswordResetRateLimit } from './auth/password-reset-rate-limit';
import { PasswordService } from './auth/password';
import { AuditService } from './audit';
import { createAutomationService, type AutomationService } from './automation';
import { createPlatformCapabilityRegistry, type CapabilityRegistry } from './capabilities';
import { API_PREFIX } from './constants';
import { createCopilotService, createDefaultCopilotRegistry, createCopilotConfirmations, type CopilotService } from './copilot';
import {
  createDefaultIntentRegistry,
  createIntentConfirmations,
  createIntentService,
  type IntentService,
} from './intents';
import {
  createProblemIntelligenceService,
  type ProblemIntelligenceService,
} from './problem-intelligence';
import {
  createCapabilityRecommendationService,
  type CapabilityRecommendationService,
} from './capability-recommendations';
import {
  createProjectPlanningService,
  type ProjectPlanningService,
} from './project-planning';
import {
  createProjectGeneratorService,
  type ProjectGeneratorService,
} from './project-generator';
import { AiController } from './controllers/ai.controller';
import { ApiInfoController } from './controllers/api-info.controller';
import { AuditController } from './controllers/audit.controller';
import { AuthController } from './controllers/auth.controller';
import { AutomationController } from './controllers/automation.controller';
import { CopilotController } from './controllers/copilot.controller';
import { IntentsController } from './controllers/intents.controller';
import { ProblemIntelligenceController } from './controllers/problem-intelligence.controller';
import { CapabilityRecommendationController } from './controllers/capability-recommendations.controller';
import { ProjectPlanningController } from './controllers/project-planning.controller';
import { ProjectGeneratorController } from './controllers/project-generator.controller';
import { RagController } from './controllers/rag.controller';
import { SearchController } from './controllers/search.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { DocumentController } from './controllers/document.controller';
import { FeaturesController } from './controllers/features.controller';
import { CapabilitiesController } from './controllers/capabilities.controller';
import { HealthController } from './controllers/health.controller';
import { NotificationController } from './controllers/notification.controller';
import { OdooController } from './controllers/odoo.controller';
import { JobController } from './controllers/job.controller';
import { PdfController } from './controllers/pdf.controller';
import { ReportController } from './controllers/report.controller';
import { RbacController } from './controllers/rbac.controller';
import { StorageController } from './controllers/storage.controller';
import { createAiService, isAiEnabled, type AIService } from './integrations/ai';
import { createRagService, isRagEnabled, type RagService } from './integrations/rag';
import { createSearchService, isSearchEnabled, type SearchService } from './integrations/search';
import {
  createAnalyticsService,
  isAnalyticsEnabled,
  type AnalyticsService,
} from './integrations/analytics';
import {
  createAnomalyService,
  isAnomalyEnabled,
  type AnomalyService,
} from './anomaly';
import {
  createRealtimeService,
  isRealtimeEnabled,
  type RealtimeService,
} from './realtime';
import { AnomalyController } from './controllers/anomaly.controller';
import { RealtimeController } from './controllers/realtime.controller';
import {
  createDocumentIntelligenceService,
  type DocumentIntelligenceService,
} from './integrations/documents';
import { createEmailService } from './integrations/email';
import { createSmsService } from './integrations/sms';
import { createOtpService, createOtpRateLimit, type OtpService, type OtpCodeGenerator } from './otp';
import { createOdooService, createOdooCacheFromKv, createOdooCapabilityRegistry, isOdooEnabled, type OdooService } from './integrations/odoo';
import { createPdfService } from './integrations/pdf';
import { createReportService, createDefaultReportRegistry, type ReportRegistry, type ReportService } from './integrations/reports';
import { createStorageService, resolveStorageSigning } from './integrations/storage';
import { isFeatureEnabled } from './features';
import { createEventBus, eventIdFor, type EventBus } from './events';
import { createScheduler, createSchedulerLock, type ScheduleDefinition, type Scheduler } from './scheduler';
import type { DatabaseClient } from './lib/database';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware';
import { createJobQueue, JobService, registerCleanupJob, resolveJobsDir, type JobQueue } from './jobs';
import { CacheService } from './lib/cache';
import { IdempotencyStore } from './lib/idempotency';
import { createKvStore, isRedisClient } from './lib/redis';
import { UserRepository, DocumentRepository, NotificationRepository, CopilotRepository, AuditRepository, AutomationRepository, RagRepository, AnomalyRepository, SearchRepository, AnalyticsRepository } from './repositories';
import { createHealthRouter } from './routes/health.routes';
import { createV1Router } from './routes/v1.routes';
import { composeHandlers, cookieCsrfProtection, createCorsOptions, createHelmetOptions, createRateLimitStore, createSecurityRateLimits, parseCookiesMiddleware } from './security';
import { AuthService } from './services/auth.service';
import { HealthService } from './services/health.service';
import { createNotificationService } from './notifications';
import { createObservability, requestLoggingMiddleware, type Observability } from './observability';
import { RbacService } from './services/rbac.service';
import { applyProblemModule, createProblemHost, loadProblemModule, type ProblemModule } from './problem';
import { bindPlatformPlugins, type PlatformPlugin } from './platform';
import type { AppConfig } from './types/config';
import type { Pingable } from './types/lifecycle';
import { asyncHandler } from './utils/async-handler';
import type { AppLogger } from './utils/logger';

export interface CreateAppOptions {
  config: AppConfig;
  logger: AppLogger;
  database?: Pingable | null;
  redis?: Pingable | null;
  odoo?: Pingable | null;
  odooService?: OdooService | null;
  ai?: Pingable | null;
  aiService?: AIService | null;
  ragService?: RagService | null;
  searchService?: SearchService | null;
  analyticsService?: AnalyticsService | null;
  anomalyService?: AnomalyService | null;
  realtimeService?: RealtimeService | null;
  documentService?: DocumentIntelligenceService | null;
  copilotService?: CopilotService | null;
  intentService?: IntentService | null;
  problemIntelligenceService?: ProblemIntelligenceService | null;
  capabilityRecommendationService?: CapabilityRecommendationService | null;
  projectPlanningService?: ProjectPlanningService | null;
  projectGeneratorService?: ProjectGeneratorService | null;
  automationService?: AutomationService | null;
  events?: EventBus | null;
  jobs?: JobQueue | null;
  scheduler?: Scheduler | null;
  schedules?: ScheduleDefinition[];
  otpService?: OtpService | null;
  otpGenerator?: OtpCodeGenerator;
  reportRegistry?: ReportRegistry;
  reportService?: ReportService | null;
  observability?: Observability;
  problemModule?: ProblemModule | null;
  plugins?: readonly PlatformPlugin[];
  capabilityRegistry?: CapabilityRegistry;
}

export interface AppContext {
  app: Express;
  healthService: HealthService;
  jobs: JobQueue;
  scheduler: Scheduler | null;
  realtime: RealtimeService | null;
  observability: Observability;
  problemModule: ProblemModule | null;
  capabilities: CapabilityRegistry;
  pluginNames: readonly string[];
}

export function createApp(options: CreateAppOptions): AppContext {
  const app = express();
  const observability = options.observability ?? createObservability();
  const capabilityRegistry = options.capabilityRegistry ?? createPlatformCapabilityRegistry();
  const prisma = getPrisma(options.database);
  const events = options.events ?? createEventBus(options.logger);
  const tokenService =
    options.config.jwt.accessSecret && options.config.jwt.refreshSecret
      ? createTokenServiceFromConfig(options.config)
      : null;
  const users = prisma ? new UserRepository(prisma) : null;
  const allowMemorySecurity = !options.config.isProduction;
  const rateLimitStore = createRateLimitStore(options.redis, { allowMemory: allowMemorySecurity });
  const kv = createKvStore(isRedisClient(options.redis) ? options.redis : null, {
    allowMemory: allowMemorySecurity,
  });
  const revocation = tokenService
    ? new TokenRevocationStore(kv, tokenService.accessExpiresInSeconds * 1000)
    : null;
  const auditService = new AuditService(
    prisma ? new AuditRepository(prisma) : null,
    options.logger,
  );
  const authService =
    prisma && tokenService
      ? new AuthService({
          prisma,
          passwordService: new PasswordService(options.config.auth.password),
          tokenService,
          defaultRole: options.config.auth.defaultRole,
          revocation,
          audit: auditService,
          onUserCreated: (user) => {
            void events.emit({
              type: 'user.created',
              id: eventIdFor('user.created', user.id),
              payload: {
                userId: user.id,
                email: user.email,
                displayName: user.displayName,
                companyName: user.companyName,
              },
            });
          },
        })
      : null;
  const cache = new CacheService(kv);
  const idempotency = new IdempotencyStore(kv);
  const realtime =
    options.realtimeService === undefined
      ? isRealtimeEnabled(options.config)
        ? createRealtimeService({
            config: options.config,
            logger: options.logger,
            redisUrl: options.config.redisUrl,
          })
        : null
      : options.realtimeService;
  const jobs =
    options.jobs ??
    createJobQueue({
      logger: options.logger,
      redisUrl: options.config.redisUrl,
      jobsDir: options.config.redisUrl || options.config.isTest ? undefined : resolveJobsDir(),
      defaultAttempts: options.config.jobs.maxAttempts,
      defaultBackoffMs: options.config.jobs.backoffMs,
      defaultTimeoutMs: options.config.jobs.timeoutMs,
      processJobs: options.config.jobs.process,
      metrics: observability.metrics,
      onStatus: realtime ? (record) => realtime.publishJob(record) : undefined,
    });
  registerCleanupJob(jobs, kv);

  const odooService =
    options.odooService === undefined
      ? createOdooService({
          config: options.config,
          logger: options.logger,
          cache: createOdooCacheFromKv(cache),
          jobs,
          audit: auditService,
        })
      : options.odooService;
  const odooPing =
    options.odoo === undefined ? (isOdooEnabled(options.config) ? odooService : null) : options.odoo;

  const aiService =
    options.aiService === undefined
      ? createAiService({
          config: options.config,
          logger: options.logger,
          jobs,
          audit: auditService,
          metrics: observability.metrics,
        })
      : options.aiService;
  const aiPing = options.ai === undefined ? (isAiEnabled(options.config) ? aiService : null) : options.ai;

  const ragService =
    options.ragService === undefined
      ? isRagEnabled(options.config) && aiService
        ? createRagService({
            config: options.config,
            logger: options.logger,
            ai: aiService,
            jobs,
            audit: auditService,
            ragDocuments: prisma ? new RagRepository(prisma) : null,
          })
        : null
      : options.ragService;

  const searchService =
    options.searchService === undefined
      ? isSearchEnabled(options.config)
        ? createSearchService({
            config: options.config,
            logger: options.logger,
            audit: auditService,
            documents: prisma ? new SearchRepository(prisma) : null,
          })
        : null
      : options.searchService;

  const analyticsService =
    options.analyticsService === undefined
      ? isAnalyticsEnabled(options.config)
        ? createAnalyticsService({
            config: options.config,
            logger: options.logger,
            audit: auditService,
            facts: prisma ? new AnalyticsRepository(prisma) : null,
          })
        : null
      : options.analyticsService;

  const storage = createStorageService(options.config, { prisma, audit: auditService });
  const emailService = createEmailService({
    config: options.config,
    logger: options.logger,
    jobs,
    idempotency,
    ai: aiService,
  });
  const smsService = createSmsService({
    config: options.config,
    jobs,
    idempotency,
  });
  const otpService =
    options.otpService === undefined
      ? isFeatureEnabled(options.config, 'otp')
        ? createOtpService({
            config: options.config,
            logger: options.logger,
            kv,
            generator: options.otpGenerator,
            email: emailService,
            sms: smsService,
          })
        : null
      : options.otpService;
  const emitReportCompleted = (event: { key: string; filename: string; title: string; type?: string }) => {
    if (!isFeatureEnabled(options.config, 'automation')) {
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
  const notificationService =
    prisma && users
      ? createNotificationService({
          notifications: new NotificationRepository(prisma),
          users,
          email: emailService,
          sms: smsService,
          jobs,
          idempotency,
          config: options.config,
          audit: auditService,
          metrics: observability.metrics,
          onInAppCreated: realtime
            ? (event) => realtime.publishNotification(event)
            : undefined,
        })
      : null;
  const documentService =
    options.documentService === undefined
      ? prisma
        ? createDocumentIntelligenceService({
            config: options.config,
            logger: options.logger,
            documents: new DocumentRepository(prisma),
            storage,
            ai: aiService,
            jobs,
            onUploaded: (event) => {
              if (!isFeatureEnabled(options.config, 'automation')) {
                return;
              }
              void events.emit({
                type: 'document.uploaded',
                id: eventIdFor('document.uploaded', event.documentId),
                payload: { ...event },
              });
            },
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
              if (isFeatureEnabled(options.config, 'notifications') && notificationService) {
                void notificationService
                  .notify({
                    userId: event.userId,
                    type: event.requiresReview ? 'warning' : 'success',
                    title: 'Document analysis finished',
                    body: `Your ${event.documentType} document is ${event.status}.`,
                  })
                  .catch((error: unknown) => {
                    options.logger.warn(
                      { err: error, documentId: event.documentId },
                      'Failed to record document notification',
                    );
                  });
              }
            },
          })
        : null
      : options.documentService;

  const reportService =
    options.reportService === undefined
      ? createReportService({
          storage,
          jobs,
          notifications: notificationService,
          email: emailService,
          registry: options.reportRegistry,
          appName: options.config.app.name,
          onGenerated: emitReportCompleted,
          audit: auditService,
        })
      : options.reportService;

  const anomalyService =
    options.anomalyService === undefined
      ? isAnomalyEnabled(options.config)
        ? createAnomalyService({
            config: options.config,
            logger: options.logger,
            ai: aiService,
            jobs,
            audit: auditService,
            events,
            notifications: notificationService,
            store: prisma ? new AnomalyRepository(prisma) : undefined,
          })
        : null
      : options.anomalyService;

  const copilotRegistry = createDefaultCopilotRegistry({
    notifications: notificationService,
    pdf: pdfService,
    documents: documentService,
    odoo: odooService,
    ai: aiService,
    rag: ragService,
    search: searchService,
    analytics: analyticsService,
    anomaly: anomalyService,
    demoMode: options.config.demoMode,
  });
  const copilotService =
    options.copilotService === undefined
      ? isFeatureEnabled(options.config, 'copilot') && prisma && aiService
        ? createCopilotService({
            config: options.config,
            logger: options.logger,
            ai: aiService,
            registry: copilotRegistry,
            conversations: new CopilotRepository(prisma),
            audit: auditService,
            confirmations: createCopilotConfirmations(kv),
          })
        : null
      : options.copilotService;

  const intentRegistry = createDefaultIntentRegistry({
    demoMode: options.config.demoMode,
  });
  const intentService =
    options.intentService === undefined
      ? isFeatureEnabled(options.config, 'intents') && aiService
        ? createIntentService({
            config: options.config,
            logger: options.logger,
            ai: aiService,
            registry: intentRegistry,
            confirmations: createIntentConfirmations(kv),
            audit: auditService,
          })
        : null
      : options.intentService;

  const problemIntelligenceService =
    options.problemIntelligenceService === undefined
      ? isFeatureEnabled(options.config, 'problemIntelligence') && aiService
        ? createProblemIntelligenceService({
            config: options.config,
            logger: options.logger,
            ai: aiService,
            capabilities: capabilityRegistry,
            audit: auditService,
          })
        : null
      : options.problemIntelligenceService;

  const capabilityRecommendationService =
    options.capabilityRecommendationService === undefined
      ? isFeatureEnabled(options.config, 'capabilityRecommendations')
        ? createCapabilityRecommendationService({
            config: options.config,
            logger: options.logger,
            audit: auditService,
          })
        : null
      : options.capabilityRecommendationService;

  const projectPlanningService =
    options.projectPlanningService === undefined
      ? isFeatureEnabled(options.config, 'projectPlanning')
        ? createProjectPlanningService({
            config: options.config,
            logger: options.logger,
            audit: auditService,
            problemIntelligence: problemIntelligenceService,
          })
        : null
      : options.projectPlanningService;

  const projectGeneratorService =
    options.projectGeneratorService === undefined
      ? isFeatureEnabled(options.config, 'projectGenerator')
        ? createProjectGeneratorService({
            config: options.config,
            logger: options.logger,
            audit: auditService,
          })
        : null
      : options.projectGeneratorService;

  const automationService =
    options.automationService === undefined
      ? isFeatureEnabled(options.config, 'automation') && prisma
        ? createAutomationService({
            config: options.config,
            logger: options.logger,
            store: new AutomationRepository(prisma),
            jobs,
            events,
            audit: auditService,
            actionDeps: {
              email: emailService,
              notifications: notificationService,
              pdf: pdfService,
              ai: aiService,
              odoo: odooService,
              jobs,
              audit: auditService,
            },
            onExecutionUpdated: realtime
              ? (event) => realtime.publishAutomation(event)
              : undefined,
          })
        : null
      : options.automationService;

  const healthService = new HealthService({
    serviceName: options.config.app.name,
    environment: options.config.nodeEnv,
    database: options.database,
    redis: options.redis,
    odoo: odooPing,
    ai: aiPing,
  });

  const healthController = new HealthController(healthService);
  const apiInfoController = new ApiInfoController(options.config);
  const featuresController = new FeaturesController(options.config);
  const capabilitiesController = new CapabilitiesController(capabilityRegistry, options.config);
  const authController = new AuthController(authService, otpService, options.config);
  const auditController = new AuditController(prisma ? auditService : null);
  const rbacController = new RbacController(prisma ? new RbacService(prisma, auditService) : null);
  const odooController = new OdooController(odooService);
  const aiController = new AiController(aiService);
  const documentController = new DocumentController(documentService);
  const notificationController = new NotificationController(notificationService);
  const pdfEnabled = isFeatureEnabled(options.config, 'pdf');
  const pdfController = new PdfController(pdfEnabled ? pdfService : null, storage);
  const reportController = new ReportController(pdfEnabled ? reportService : null, storage);
  const storageController = new StorageController(
    storage,
    resolveStorageSigning(options.config)?.secret ?? '',
  );
  const copilotController = new CopilotController(copilotService);
  const intentsController = new IntentsController(intentService);
  const problemIntelligenceController = new ProblemIntelligenceController(problemIntelligenceService);
  const capabilityRecommendationController = new CapabilityRecommendationController(
    capabilityRecommendationService,
  );
  const projectPlanningController = new ProjectPlanningController(projectPlanningService);
  const projectGeneratorController = new ProjectGeneratorController(projectGeneratorService);
  const ragController = new RagController(ragService);
  const searchController = new SearchController(searchService);
  const analyticsController = new AnalyticsController(analyticsService);
  const anomalyController = new AnomalyController(anomalyService);
  const realtimeController = new RealtimeController(realtime);
  const automationController = new AutomationController(automationService);
  const jobController = new JobController(new JobService(jobs));
  const authenticate = createAuthenticate({ tokenService, users, revocation });
  const authenticateOptional = createAuthenticateOptional({ tokenService, users, revocation });
  const rateLimits = createSecurityRateLimits({
    store: rateLimitStore,
    config: options.config,
    logger: options.logger,
  });
  const authenticateUser = composeHandlers(authenticate, rateLimits.authenticated);
  const authenticateAi = composeHandlers(authenticateUser, rateLimits.ai);
  const authenticateAdmin = composeHandlers(authenticateUser, rateLimits.admin);
  const loginRateLimit = createLoginRateLimit({
    store: rateLimitStore,
    config: options.config,
    logger: options.logger,
  });
  const otpRateLimit = createOtpRateLimit({
    store: rateLimitStore,
    config: options.config,
    logger: options.logger,
  });
  const passwordResetRateLimit = createPasswordResetRateLimit({
    store: rateLimitStore,
    config: options.config,
    logger: options.logger,
  });

  applyBaseMiddleware(app, options.config, options.logger, observability.metrics);
  app.use(createHealthRouter(healthController));
  app.use(
    API_PREFIX,
    createV1Router({
      apiInfoController,
      featuresController,
      capabilitiesController,
      authController,
      auditController,
      rbacController,
      odooController,
      aiController,
      documentController,
      notificationController,
      pdfController,
      reportController,
      storageController,
      copilotController,
      intentsController,
      problemIntelligenceController,
      capabilityRecommendationController,
      projectPlanningController,
      projectGeneratorController,
      ragController,
      searchController,
      analyticsController,
      anomalyController,
      realtimeController,
      automationController,
      jobController,
      authenticate: authenticateUser,
      authenticateOptional,
      authenticateAi,
      authenticateAdmin,
      loginRateLimit,
      otpRateLimit,
      passwordResetRateLimit,
      rateLimits,
      documentMaxBytes: options.config.documents.maxBytes,
      storageMaxBytes: options.config.storage.maxBytes,
    }),
  );

  const scheduler =
    options.scheduler === undefined
      ? createScheduler({
          config: options.config,
          logger: options.logger,
          events,
          schedules: options.schedules,
          lock: createSchedulerLock(kv),
        })
      : options.scheduler;

  const pluginNames = bindPlatformPlugins({
    plugins: options.plugins,
    role: 'api',
    config: options.config,
    logger: options.logger,
    jobs,
    events,
    scheduler,
    capabilities: capabilityRegistry,
    registries: {
      copilot: copilotRegistry,
      intents: intentRegistry,
      odooCapabilities: odooService?.capabilities ?? createOdooCapabilityRegistry(),
      automation: automationService?.registries ?? null,
      reports: reportService?.getRegistry() ?? options.reportRegistry ?? createDefaultReportRegistry(),
    },
  });

  const problemModule = options.problemModule === undefined ? loadProblemModule() : options.problemModule;
  if (problemModule) {
    applyProblemModule(
      createProblemHost({
        stage: 'api',
        config: options.config,
        logger: options.logger,
        jobs,
        events,
        prisma,
        capabilities: capabilityRegistry,
        audit: auditService,
        notifications: notificationService
          ? {
              notify: (input) => notificationService.notify(input),
            }
          : null,
        app,
        http: {
          authenticate: authenticateUser,
          publicRateLimit: rateLimits.publicApi,
          authenticatedRateLimit: rateLimits.authenticated,
        },
        scheduler,
        copilot: copilotRegistry,
        intents: intentRegistry,
        reports: reportService?.getRegistry() ?? options.reportRegistry ?? null,
        automation: automationService?.registries ?? null,
        ai: aiService,
        odoo: odooService,
        realtime: realtime
          ? {
              publish: (input) =>
                realtime.publish({
                  channel: input.channel as 'dashboard',
                  type: input.type as 'dashboard.updated',
                  payload: input.payload,
                }),
            }
          : null,
        search: searchService,
        analytics: analyticsService,
      }),
      problemModule,
    );
  }

  app.use(asyncHandler(notFoundHandler));
  app.use(errorHandler(options.logger, options.config.isProduction, observability.errors));

  if (scheduler && !options.config.isTest) {
    scheduler.start();
  }

  return { app, healthService, jobs, scheduler, realtime, observability, problemModule, capabilities: capabilityRegistry, pluginNames };
}

function applyBaseMiddleware(
  app: Application,
  config: AppConfig,
  logger: AppLogger,
  metrics?: Observability['metrics'] | null,
): void {
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet(createHelmetOptions(config)));
  app.use(cors(createCorsOptions(config)));
  app.use(parseCookiesMiddleware());
  app.use(cookieCsrfProtection(config));
  app.use(requestIdMiddleware);
  app.use(requestLoggingMiddleware(logger, metrics));
  app.use(express.json({ limit: config.requestBodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.requestBodyLimit }));
}

function getPrisma(database?: Pingable | null): PrismaClient | null {
  if (!database || !('prisma' in database)) {
    return null;
  }

  return (database as DatabaseClient).prisma;
}
