import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Structural host the platform passes into `register()`.
 * Typed here so this package does not import `backend/src` (that would break
 * `rootDir` on emit). The API/worker pass a compatible object.
 */
export interface ProblemHost {
  stage: 'api' | 'worker';
  mount?: (basePath: string, router: Router) => void;
  http?: {
    Router: (options?: unknown) => Router;
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
  };
  jobs: {
    process: (
      name: string,
      handler: (payload: Record<string, unknown> & { requestId: string }) => Promise<void>,
    ) => void;
    enqueue: (name: string, payload: Record<string, unknown>) => Promise<string>;
  };
  events: {
    on: (
      type: string,
      handler: (event: { type: string; payload: Record<string, unknown> }) => unknown,
    ) => unknown;
    emit: (input: { type: string; payload?: Record<string, unknown> }) => Promise<unknown>;
  };
  prisma?: unknown;
  notifications?: {
    notify: (input: {
      userId: string;
      type?: 'info' | 'success' | 'warning' | 'error';
      title: string;
      body: string;
    }) => Promise<unknown>;
    sendCustomerEmail?: (input: {
      to: string;
      subject: string;
      text: string;
      html?: string;
      attachments?: Array<{ filename: string; contentBase64: string; contentType: string }>;
      idempotencyKey: string;
      quoteId: string;
      eventType: string;
      data?: Record<string, unknown>;
    }) => Promise<{
      status: 'sent' | 'not_configured' | 'failed' | 'skipped';
      provider?: string;
      providerMessageId?: string;
      notificationDeliveryId?: string;
      error?: string;
    }>;
  } | null;
  audit?: {
    record: (input: {
      actorId?: string;
      userId?: string;
      action: string;
      resource?: string;
      resourceId?: string;
      metadata?: unknown;
      request?: unknown;
      status?: string;
      oldValue?: unknown;
      newValue?: unknown;
    }) => Promise<void>;
    list?: (query: Record<string, unknown>) => Promise<unknown>;
  };
  logger: {
    info: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
  };
  copilot?: { register: (tool: unknown) => unknown };
  intents?: { register: (intent: unknown) => unknown };
  reports?: {
    registerTemplate: (template: unknown) => unknown;
    registerDataProvider: (type: string, provider: unknown) => unknown;
  };
  automation?: {
    triggers: { register: (trigger: unknown) => unknown };
    actions: { register: (action: unknown) => unknown };
    allowedJobs: { allow: (name: string) => unknown };
  };
  scheduler?: {
    register: (definition: {
      name: string;
      intervalMs?: number;
      cron?: string;
      trigger?: string;
    }) => unknown;
  };
  ai?: unknown;
  odoo?: {
    runtime?: { enabled?: boolean };
    create?: (input: Record<string, unknown>) => Promise<unknown>;
  } | null;
  realtime?: {
    publish: (input: {
      channel: string;
      type: string;
      payload?: Record<string, unknown>;
    }) => Promise<unknown> | unknown;
  } | null;
  search?: {
    registerIndex: (definition: unknown) => unknown;
    index: (document: unknown, actor: unknown) => Promise<unknown>;
    search: (query: unknown) => Promise<unknown>;
  };
  analytics?: {
    registerKpi: (definition: unknown) => unknown;
    registerDashboard: (definition: unknown) => unknown;
    ingest: (facts: unknown, actor: unknown) => Promise<unknown>;
    query: (input: unknown) => Promise<unknown>;
  };
  odooAdapters?: { create: (options: Record<string, unknown>) => unknown };
  capabilities?: {
    register: (capability: ProblemCapability) => unknown;
  };
}

export interface ProblemCapability {
  name: string;
  version: string;
  kind: 'application' | 'infrastructure' | 'adapter' | 'architecture-mode' | 'deployment-mode';
  category: string;
  maturity: 'experimental' | 'beta' | 'stable' | 'enterprise' | 'deprecated';
  summary: string;
  dependencies: readonly string[];
  optionalDependencies: readonly string[];
  conflicts: readonly string[];
  environmentRequirements: readonly string[];
  infrastructureRequirements: readonly string[];
  providerRequirements: readonly string[];
  permissions: readonly string[];
  architectureCompatibility: readonly string[];
  deploymentCompatibility: readonly string[];
  frontendAvailability: boolean;
  backendAvailability: boolean;
  workerRequirement: boolean;
  databaseRequirement: boolean;
  tests: readonly string[];
  documentation: readonly string[];
}

export interface ProblemPermission {
  key: string;
  description: string;
}

export interface ProblemModule {
  id: string;
  permissions: readonly ProblemPermission[];
  rolePermissions?: Readonly<Record<string, readonly string[]>>;
  capabilities?: readonly ProblemCapability[];
  register(host: ProblemHost): void;
}
