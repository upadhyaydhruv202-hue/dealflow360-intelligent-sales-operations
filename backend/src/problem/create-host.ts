import type { Express } from 'express';
import { Router } from 'express';

import type { CapabilityRegistry } from '../capabilities';
import type { AuditService } from '../audit';
import type { AutomationRegistries } from '../automation';
import type { CopilotToolRegistry } from '../copilot';
import type { EventBus } from '../events';
import { createOdooModelAdapter } from '../integrations/odoo';
import type { AIService } from '../integrations/ai';
import type { OdooService } from '../integrations/odoo';
import type { SearchService } from '../integrations/search';
import type { AnalyticsService } from '../integrations/analytics';
import type { ReportRegistry } from '../integrations/reports';
import type { IntentRegistry } from '../intents';
import type { JobQueue } from '../jobs';
import { requirePermission } from '../rbac';
import { parseBody, parseParams, parseQuery } from '../schemas/parse';
import type { Scheduler } from '../scheduler';
import type { AppConfig } from '../types/config';
import type { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../utils/async-handler';
import type { AppLogger } from '../utils/logger';
import { sendSuccess } from '../utils/response';
import { mountProblemRouter } from './register';
import type { ProblemHost, ProblemHttp } from './types';

export interface CreateProblemHostOptions {
  stage: 'api' | 'worker';
  config: AppConfig;
  logger: AppLogger;
  jobs: JobQueue;
  events: EventBus;
  prisma?: PrismaClient | null;
  capabilities?: CapabilityRegistry | null;
  audit?: AuditService | null;
  app?: Express;
  http?: Omit<
    ProblemHttp,
    'Router' | 'requirePermission' | 'asyncHandler' | 'sendSuccess' | 'parseBody' | 'parseQuery' | 'parseParams'
  > &
    Partial<
      Pick<
        ProblemHttp,
        'requirePermission' | 'asyncHandler' | 'sendSuccess' | 'parseBody' | 'parseQuery' | 'parseParams'
      >
    >;
  scheduler?: Scheduler | null;
  copilot?: CopilotToolRegistry | null;
  intents?: IntentRegistry | null;
  reports?: ReportRegistry | null;
  automation?: AutomationRegistries | null;
  ai?: AIService | null;
  odoo?: OdooService | null;
  search?: SearchService | null;
  analytics?: AnalyticsService | null;
}

export function createProblemHost(options: CreateProblemHostOptions): ProblemHost {
  const prisma = options.prisma ?? null;
  const odoo = options.odoo ?? null;

  return {
    stage: options.stage,
    config: options.config,
    logger: options.logger,
    prisma,
    jobs: options.jobs,
    events: options.events,
    capabilities: options.capabilities ?? null,
    audit: options.audit ?? null,
    mount: options.app ? mountProblemRouter(options.app) : undefined,
    http: options.http
      ? {
          Router,
          requirePermission,
          asyncHandler,
          sendSuccess,
          parseBody,
          parseQuery,
          parseParams,
          ...options.http,
        }
      : undefined,
    scheduler: options.scheduler ?? null,
    copilot: options.copilot ?? null,
    intents: options.intents ?? null,
    reports: options.reports ?? null,
    automation: options.automation ?? null,
    ai: options.ai ?? null,
    odoo,
    search: options.search ?? null,
    analytics: options.analytics ?? null,
    odooAdapters: odoo
      ? {
          create: (adapterOptions) => createOdooModelAdapter({ ...adapterOptions, service: odoo }),
        }
      : undefined,
  };
}
