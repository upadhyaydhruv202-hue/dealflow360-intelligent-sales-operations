import type { PrismaClient } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import type { ZodTypeAny } from 'zod';

import type { CapabilityDefinition, CapabilityRegistry } from '../capabilities';
import type { AuditService } from '../audit';
import type { AutomationRegistries } from '../automation';
import type { CopilotToolRegistry } from '../copilot';
import type { EventBus } from '../events';
import type { AIService } from '../integrations/ai';
import type { OdooService } from '../integrations/odoo';
import type { SearchService } from '../integrations/search';
import type { AnalyticsService } from '../integrations/analytics';
import type { OdooModelAdapterOptions } from '../integrations/odoo/models/create-adapter';
import type { OdooModelAdapter } from '../integrations/odoo/models/types';
import type { ReportRegistry } from '../integrations/reports';
import type { IntentRegistry } from '../intents';
import type { JobQueue } from '../jobs';
import type { Scheduler } from '../scheduler';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';

export interface ProblemPermission {
  key: string;
  description: string;
}

export interface ProblemHttp {
  Router: typeof import('express').Router;
  authenticate: RequestHandler;
  requirePermission: (...keys: string[]) => RequestHandler;
  publicRateLimit: RequestHandler;
  authenticatedRateLimit: RequestHandler;
  asyncHandler: (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
  ) => RequestHandler;
  sendSuccess: (res: Response, data: unknown, statusCode?: number) => Response;
  parseBody: <T extends ZodTypeAny>(schema: T, data: unknown) => T['_output'];
  parseQuery: <T extends ZodTypeAny>(schema: T, data: unknown) => T['_output'];
  parseParams: <T extends ZodTypeAny>(schema: T, data: unknown) => T['_output'];
}

export interface ProblemHost {
  stage: 'api' | 'worker';
  config: AppConfig;
  logger: AppLogger;
  prisma: PrismaClient | null;
  jobs: JobQueue;
  events: EventBus;
  capabilities?: CapabilityRegistry | null;
  audit?: AuditService | null;
  mount?: (basePath: string, router: Router) => void;
  http?: ProblemHttp;
  scheduler?: Scheduler | null;
  copilot?: CopilotToolRegistry | null;
  intents?: IntentRegistry | null;
  reports?: ReportRegistry | null;
  automation?: AutomationRegistries | null;
  ai?: AIService | null;
  odoo?: OdooService | null;
  search?: SearchService | null;
  analytics?: AnalyticsService | null;
  odooAdapters?: {
    create: (options: Omit<OdooModelAdapterOptions, 'service'>) => OdooModelAdapter;
  };
}

export interface ProblemModule {
  id: string;
  permissions: readonly ProblemPermission[];
  rolePermissions?: Readonly<Record<string, readonly string[]>>;
  capabilities?: readonly CapabilityDefinition[];
  register(host: ProblemHost): void;
}
