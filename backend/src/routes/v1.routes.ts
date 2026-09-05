import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { ApiInfoController } from '../controllers/api-info.controller';
import type { AuditController } from '../controllers/audit.controller';
import type { AuthController } from '../controllers/auth.controller';
import type { CopilotController } from '../controllers/copilot.controller';
import type { IntentsController } from '../controllers/intents.controller';
import type { ProblemIntelligenceController } from '../controllers/problem-intelligence.controller';
import type { CapabilityRecommendationController } from '../controllers/capability-recommendations.controller';
import type { ProjectPlanningController } from '../controllers/project-planning.controller';
import type { ProjectGeneratorController } from '../controllers/project-generator.controller';
import type { RagController } from '../controllers/rag.controller';
import type { SearchController } from '../controllers/search.controller';
import type { AnalyticsController } from '../controllers/analytics.controller';
import type { AnomalyController } from '../controllers/anomaly.controller';
import type { RealtimeController } from '../controllers/realtime.controller';
import type { FeaturesController } from '../controllers/features.controller';
import type { CapabilitiesController } from '../controllers/capabilities.controller';
import type { AutomationController } from '../controllers/automation.controller';
import type { AiController } from '../controllers/ai.controller';
import type { DocumentController } from '../controllers/document.controller';
import type { JobController } from '../controllers/job.controller';
import type { NotificationController } from '../controllers/notification.controller';
import type { OdooController } from '../controllers/odoo.controller';
import type { PdfController } from '../controllers/pdf.controller';
import type { ReportController } from '../controllers/report.controller';
import type { RbacController } from '../controllers/rbac.controller';
import type { StorageController } from '../controllers/storage.controller';
import type { SecurityRateLimits } from '../security';
import { createAiRouter } from './ai.routes';
import { createAuditRouter } from './audit.routes';
import { createAuthRouter } from './auth.routes';
import { createCopilotRouter } from './copilot.routes';
import { createIntentsRouter } from './intents.routes';
import { createProblemIntelligenceRouter } from './problem-intelligence.routes';
import { createCapabilityRecommendationRouter } from './capability-recommendations.routes';
import { createProjectPlanningRouter } from './project-planning.routes';
import { createProjectGeneratorRouter } from './project-generator.routes';
import { createRagRouter } from './rag.routes';
import { createSearchRouter } from './search.routes';
import { createAnalyticsRouter } from './analytics.routes';
import { createAnomalyRouter } from './anomaly.routes';
import { createRealtimeRouter } from './realtime.routes';
import { createAutomationRouter } from './automation.routes';
import { createDocumentRouter } from './document.routes';
import { createFeaturesRouter } from './features.routes';
import { createCapabilitiesRouter } from './capabilities.routes';
import { createJobRouter } from './job.routes';
import { createNotificationRouter } from './notification.routes';
import { createOdooRouter } from './odoo.routes';
import { createPdfRouter } from './pdf.routes';
import { createReportRouter } from './report.routes';
import { createRbacRouter } from './rbac.routes';
import { createStorageRouter } from './storage.routes';

export function createV1Router(options: {
  apiInfoController: ApiInfoController;
  authController: AuthController;
  auditController: AuditController;
  rbacController: RbacController;
  odooController: OdooController;
  aiController: AiController;
  documentController: DocumentController;
  notificationController: NotificationController;
  pdfController: PdfController;
  reportController: ReportController;
  storageController: StorageController;
  copilotController: CopilotController;
  intentsController: IntentsController;
  problemIntelligenceController: ProblemIntelligenceController;
  capabilityRecommendationController: CapabilityRecommendationController;
  projectPlanningController: ProjectPlanningController;
  projectGeneratorController: ProjectGeneratorController;
  ragController: RagController;
  searchController: SearchController;
  analyticsController: AnalyticsController;
  anomalyController: AnomalyController;
  realtimeController: RealtimeController;
  automationController: AutomationController;
  featuresController: FeaturesController;
  capabilitiesController: CapabilitiesController;
  jobController: JobController;
  authenticate: RequestHandler;
  authenticateOptional?: RequestHandler;
  authenticateAi: RequestHandler;
  authenticateAdmin: RequestHandler;
  loginRateLimit: RequestHandler;
  otpRateLimit: RequestHandler;
  passwordResetRateLimit: RequestHandler;
  rateLimits: SecurityRateLimits;
  documentMaxBytes?: number;
  storageMaxBytes?: number;
}): Router {
  const router = Router();
  router.get(API_ROUTE_PATHS.root, options.rateLimits.publicApi, options.apiInfoController.getInfo);
  router.use(
    createFeaturesRouter({
      controller: options.featuresController,
      publicRateLimit: options.rateLimits.publicApi,
    }),
  );
  router.use(
    createCapabilitiesRouter({
      controller: options.capabilitiesController,
      publicRateLimit: options.rateLimits.publicApi,
    }),
  );
  router.use(
    API_ROUTE_PATHS.auth.root,
    createAuthRouter({
      controller: options.authController,
      authenticate: options.authenticate,
      loginRateLimit: options.loginRateLimit,
      otpRateLimit: options.otpRateLimit,
      passwordResetRateLimit: options.passwordResetRateLimit,
      publicRateLimit: options.rateLimits.publicApi,
      authenticationRateLimit: options.rateLimits.authentication,
    }),
  );
  router.use(
    createRbacRouter({
      controller: options.rbacController,
      authenticate: options.authenticateAdmin,
    }),
  );
  router.use(
    createAuditRouter({
      controller: options.auditController,
      authenticate: options.authenticateAdmin,
    }),
  );
  router.use(
    createOdooRouter({
      controller: options.odooController,
      authenticate: options.authenticate,
    }),
  );
  router.use(
    createAiRouter({
      controller: options.aiController,
      authenticate: options.authenticateAi,
    }),
  );
  router.use(
    createDocumentRouter({
      controller: options.documentController,
      authenticate: options.authenticate,
      uploadRateLimit: options.rateLimits.fileUpload,
      maxBytes: options.documentMaxBytes,
    }),
  );
  router.use(
    createNotificationRouter({
      controller: options.notificationController,
      authenticate: options.authenticate,
    }),
  );
  router.use(
    createPdfRouter({
      controller: options.pdfController,
      authenticate: options.authenticate,
    }),
  );
  router.use(
    createReportRouter({
      controller: options.reportController,
      authenticate: options.authenticate,
    }),
  );
  router.use(
    createStorageRouter({
      controller: options.storageController,
      authenticate: options.authenticate,
      authenticateOptional: options.authenticateOptional,
      publicRateLimit: options.rateLimits.publicApi,
      uploadRateLimit: options.rateLimits.fileUpload,
      maxBytes: options.storageMaxBytes,
    }),
  );
  router.use(
    createCopilotRouter({
      controller: options.copilotController,
      authenticate: options.authenticateAi,
    }),
  );
  router.use(
    createIntentsRouter({
      controller: options.intentsController,
      authenticate: options.authenticateAi,
    }),
  );
  router.use(
    createProblemIntelligenceRouter({
      controller: options.problemIntelligenceController,
      authenticate: options.authenticateAi,
    }),
  );
  router.use(
    createCapabilityRecommendationRouter({
      controller: options.capabilityRecommendationController,
      authenticate: options.authenticate,
    }),
  );
  router.use(
    createProjectPlanningRouter({
      controller: options.projectPlanningController,
      authenticate: options.authenticate,
      authenticateAnalyze: options.authenticateAi,
    }),
  );
  router.use(
    createProjectGeneratorRouter({
      controller: options.projectGeneratorController,
      authenticate: options.authenticate,
    }),
  );
  router.use(
    createRagRouter({
      controller: options.ragController,
      authenticate: options.authenticateAi,
    }),
  );
  router.use(
    createSearchRouter({
      controller: options.searchController,
      authenticate: options.authenticate,
    }),
  );
  router.use(
    createAnalyticsRouter({
      controller: options.analyticsController,
      authenticate: options.authenticate,
    }),
  );
  router.use(
    createAnomalyRouter({
      controller: options.anomalyController,
      authenticate: options.authenticateAi,
    }),
  );
  router.use(
    createRealtimeRouter({
      controller: options.realtimeController,
      authenticate: options.authenticate,
    }),
  );
  router.use(
    createAutomationRouter({
      controller: options.automationController,
      authenticate: options.authenticate,
    }),
  );
  router.use(
    createJobRouter({
      controller: options.jobController,
      authenticate: options.authenticate,
    }),
  );
  return router;
}
