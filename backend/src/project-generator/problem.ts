import type { ProjectConfiguration } from '../project-planning';
import { jsString, withTrailingNewline } from './identifiers';
import type { GeneratedFile, ProjectIdentifiers } from './types';

export function generateProblemModule(input: {
  configuration: ProjectConfiguration;
  identifiers: ProjectIdentifiers;
}): GeneratedFile[] {
  const { identifiers, configuration } = input;
  const selected = new Set(configuration.resolved.capabilities);
  const files = [
    file('modules/problem/package.json', PROBLEM_PACKAGE_JSON, 'problem'),
    file('modules/problem/tsconfig.json', PROBLEM_TSCONFIG, 'problem'),
    file('modules/problem/tsconfig.build.json', PROBLEM_TSCONFIG_BUILD, 'problem'),
    file('modules/problem/vitest.config.ts', PROBLEM_VITEST, 'problem'),
    file('modules/problem/src/host.ts', PROBLEM_HOST, 'problem'),
    file('modules/problem/src/index.ts', indexSource(identifiers), 'problem'),
    file('modules/problem/src/module.ts', moduleSource(identifiers), 'problem'),
    file('modules/problem/src/module.test.ts', moduleTestSource(identifiers), 'test'),
    file('modules/problem/src/permissions.ts', permissionsSource(identifiers), 'problem'),
    file(`modules/problem/src/${identifiers.slug}/index.ts`, domainIndexSource(identifiers), 'problem'),
    file(`modules/problem/src/${identifiers.slug}/service.ts`, serviceSource(identifiers), 'problem'),
    file(`modules/problem/src/${identifiers.slug}/service.test.ts`, serviceTestSource(identifiers), 'test'),
    file(`modules/problem/src/${identifiers.slug}/schemas.ts`, schemasSource(), 'problem'),
    file(`modules/problem/src/${identifiers.slug}/routes.ts`, routesSource(identifiers), 'problem'),
    file(`modules/problem/src/${identifiers.slug}/jobs.ts`, jobsSource(identifiers), 'problem'),
    file(`modules/problem/src/${identifiers.slug}/capability.ts`, capabilitySource(identifiers), 'problem'),
    file('modules/problem/frontend/index.ts', frontendIndexSource(identifiers), 'problem'),
    file(
      `modules/problem/frontend/${identifiers.slug}/api.ts`,
      frontendApiSource(),
      'problem',
    ),
    file(
      `modules/problem/frontend/${identifiers.slug}/${identifiers.pascal}Page.tsx`,
      frontendPageSource(identifiers),
      'problem',
    ),
    file(
      `modules/problem/frontend/${identifiers.slug}/${identifiers.pascal}Page.test.tsx`,
      frontendPageTestSource(identifiers),
      'test',
    ),
    file('modules/problem/README.md', problemReadme(identifiers, configuration), 'docs'),
  ];

  if (selected.has('odoo')) {
    files.push(
      file(`modules/problem/src/${identifiers.slug}/odoo-adapter.ts`, odooAdapterSource(), 'problem'),
    );
  }

  return files;
}

function file(path: string, contents: string, role: GeneratedFile['role']): GeneratedFile {
  return { path, contents: withTrailingNewline(contents), role };
}

function indexSource(ids: ProjectIdentifiers): string {
  const prefix = constantPrefix(ids);
  return `export type { ProblemHost, ProblemModule, ProblemPermission, ProblemCapability } from './host';
export { problemModule } from './module';
export {
  ${prefix}_EVENT_TYPE,
  ${prefix}_JOB_NAME,
  ${prefix}_MODULE_ID,
  enqueueJobBodySchema,
  getProblemManifest,
  getProblemProbe,
  PROBLEM_CAPABILITY,
} from './${ids.slug}';
export { PROBLEM_PERMISSIONS, PROBLEM_ROLE_PERMISSIONS } from './permissions';

export { problemModule as default } from './module';
`;
}

function constantPrefix(ids: ProjectIdentifiers): string {
  return ids.slug.replaceAll('-', '_').toUpperCase();
}

function moduleSource(ids: ProjectIdentifiers): string {
  const prefix = constantPrefix(ids);
  return `import type { ProblemHost, ProblemModule } from './host';
import { PROBLEM_PERMISSIONS, PROBLEM_ROLE_PERMISSIONS } from './permissions';
import { PROBLEM_CAPABILITY } from './${ids.slug}/capability';
import { createProblemRouter, registerProblemJobs, ${prefix}_MODULE_ID } from './${ids.slug}';

export const problemModule: ProblemModule = {
  id: ${prefix}_MODULE_ID,
  permissions: PROBLEM_PERMISSIONS,
  rolePermissions: PROBLEM_ROLE_PERMISSIONS,
  capabilities: [PROBLEM_CAPABILITY],
  register(host: ProblemHost) {
    registerProblemJobs(host);
    if (host.stage === 'api' && host.mount && host.http) {
      host.mount('/problem', createProblemRouter(host));
    }
  },
};
`;
}

function moduleTestSource(ids: ProjectIdentifiers): string {
  const prefix = constantPrefix(ids);
  return `import { describe, expect, it, vi } from 'vitest';

import { problemModule } from './module';
import { ${prefix}_EVENT_TYPE, ${prefix}_JOB_NAME, PROBLEM_PERMISSIONS } from './index';

describe('problemModule', () => {
  it('exports generated permissions and a stable id', () => {
    expect(problemModule.id).toBe(${jsString(ids.moduleId)});
    expect(problemModule.permissions).toEqual(PROBLEM_PERMISSIONS);
    expect(problemModule.capabilities?.[0]?.name).toBe(${jsString(`problem.${ids.camel}`)});
  });

  it('registers the job on every host and mounts HTTP only on the API', () => {
    const process = vi.fn();
    const allow = vi.fn();
    const mount = vi.fn();
    const on = vi.fn();
    const Router = vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
    }));

    problemModule.register({
      stage: 'worker',
      jobs: { process, enqueue: vi.fn() },
      events: { on, emit: vi.fn() },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      automation: {
        triggers: { register: vi.fn() },
        actions: { register: vi.fn() },
        allowedJobs: { allow },
      },
      mount,
    });

    expect(process).toHaveBeenCalledWith(${prefix}_JOB_NAME, expect.any(Function));
    expect(allow).toHaveBeenCalledWith(${prefix}_JOB_NAME);
    expect(on).toHaveBeenCalledWith(${prefix}_EVENT_TYPE, expect.any(Function));
    expect(mount).not.toHaveBeenCalled();

    problemModule.register({
      stage: 'api',
      jobs: { process, enqueue: vi.fn() },
      events: { on, emit: vi.fn() },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      mount,
      http: {
        Router: Router as never,
        authenticate: vi.fn(),
        requirePermission: vi.fn(() => vi.fn()),
        publicRateLimit: vi.fn(),
        authenticatedRateLimit: vi.fn(),
        asyncHandler: (handler) => handler as never,
        sendSuccess: vi.fn(),
        parseBody: vi.fn(),
        parseQuery: vi.fn(),
        parseParams: vi.fn(),
      },
    });

    expect(mount).toHaveBeenCalledWith('/problem', expect.any(Object));
  });
});
`;
}

function permissionsSource(ids: ProjectIdentifiers): string {
  return `import type { ProblemPermission } from './host';

export const PROBLEM_PERMISSIONS: readonly ProblemPermission[] = [
  { key: ${jsString(ids.permissionRead)}, description: ${jsString(`Read the ${ids.title} problem-module probe`)} },
  { key: ${jsString(ids.permissionRun)}, description: ${jsString(`Enqueue the ${ids.title} problem-module job`)} },
];

export const PROBLEM_ROLE_PERMISSIONS: Readonly<Record<string, readonly string[]>> = {
  manager: [${jsString(ids.permissionRead)}, ${jsString(ids.permissionRun)}],
  staff: [${jsString(ids.permissionRead)}],
};
`;
}

function domainIndexSource(ids: ProjectIdentifiers): string {
  const prefix = constantPrefix(ids);
  return `export {
  ${prefix}_EVENT_TYPE,
  ${prefix}_JOB_NAME,
  ${prefix}_MODULE_ID,
  getProblemManifest,
  getProblemProbe,
} from './service';
export { enqueueJobBodySchema } from './schemas';
export { createProblemRouter } from './routes';
export { registerProblemJobs } from './jobs';
export { PROBLEM_CAPABILITY } from './capability';
`;
}

function serviceSource(ids: ProjectIdentifiers): string {
  const prefix = constantPrefix(ids);
  return `export const ${prefix}_MODULE_ID = ${jsString(ids.moduleId)};
export const ${prefix}_JOB_NAME = ${jsString(ids.jobName)};
export const ${prefix}_EVENT_TYPE = ${jsString(ids.eventType)};

export interface ProblemManifest {
  id: typeof ${prefix}_MODULE_ID;
  title: string;
  replaceable: true;
  jobName: typeof ${prefix}_JOB_NAME;
}

export interface ProblemProbe {
  ok: true;
  module: typeof ${prefix}_MODULE_ID;
}

export function getProblemManifest(): ProblemManifest {
  return {
    id: ${prefix}_MODULE_ID,
    title: ${jsString(ids.title)},
    replaceable: true,
    jobName: ${prefix}_JOB_NAME,
  };
}

export function getProblemProbe(): ProblemProbe {
  return { ok: true, module: ${prefix}_MODULE_ID };
}
`;
}

function serviceTestSource(ids: ProjectIdentifiers): string {
  const prefix = constantPrefix(ids);
  return `import { describe, expect, it } from 'vitest';

import { enqueueJobBodySchema } from './schemas';
import {
  getProblemManifest,
  getProblemProbe,
  ${prefix}_EVENT_TYPE,
  ${prefix}_JOB_NAME,
  ${prefix}_MODULE_ID,
} from './service';

describe(${jsString(`${ids.slug} service`)}, () => {
  it('returns a replaceable manifest and probe', () => {
    expect(getProblemManifest()).toMatchObject({
      id: ${prefix}_MODULE_ID,
      replaceable: true,
      jobName: ${prefix}_JOB_NAME,
    });
    expect(getProblemProbe()).toEqual({ ok: true, module: ${prefix}_MODULE_ID });
    expect(${prefix}_EVENT_TYPE).toBe(${jsString(ids.eventType)});
  });

  it('accepts an optional note and rejects unknown fields', () => {
    expect(enqueueJobBodySchema.parse({})).toEqual({});
    expect(enqueueJobBodySchema.parse({ note: ' ping ' })).toEqual({ note: 'ping' });
    expect(enqueueJobBodySchema.safeParse({ note: 1 }).success).toBe(false);
    expect(enqueueJobBodySchema.safeParse({ extra: true }).success).toBe(false);
  });
});
`;
}

function schemasSource(): string {
  return `import { z } from 'zod';

export const enqueueJobBodySchema = z
  .object({
    note: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type EnqueueJobBody = z.infer<typeof enqueueJobBodySchema>;
`;
}

function routesSource(ids: ProjectIdentifiers): string {
  const prefix = constantPrefix(ids);
  return `import type { ProblemHost } from '../host';
import { enqueueJobBodySchema } from './schemas';
import { getProblemManifest, getProblemProbe, ${prefix}_JOB_NAME } from './service';

export function createProblemRouter(host: ProblemHost) {
  const http = host.http;
  if (!http) {
    throw new Error('Problem routes require host.http');
  }

  const router = http.Router();
  const readProblem = [http.authenticate, http.requirePermission(${jsString(ids.permissionRead)})];
  const runProblem = [http.authenticate, http.requirePermission(${jsString(ids.permissionRun)})];

  router.get('/', http.publicRateLimit, http.asyncHandler((_req, res) => http.sendSuccess(res, getProblemManifest())));
  router.get(
    '/${ids.slug}',
    http.authenticatedRateLimit,
    ...readProblem,
    http.asyncHandler((_req, res) => http.sendSuccess(res, getProblemProbe())),
  );
  router.post(
    '/${ids.slug}/jobs',
    http.authenticatedRateLimit,
    ...runProblem,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(enqueueJobBodySchema, req.body);
      const jobId = await host.jobs.enqueue(${prefix}_JOB_NAME, body.note ? { note: body.note } : {});
      return http.sendSuccess(res, { jobId, jobName: ${prefix}_JOB_NAME }, 202);
    }),
  );

  return router;
}
`;
}

function jobsSource(ids: ProjectIdentifiers): string {
  const prefix = constantPrefix(ids);
  return `import type { ProblemHost } from '../host';
import { ${prefix}_EVENT_TYPE, ${prefix}_JOB_NAME } from './service';

export function registerProblemJobs(host: ProblemHost): void {
  host.events.on(${prefix}_EVENT_TYPE, (event) => {
    host.logger.info({ eventType: event.type }, 'Problem module event handled');
  });

  host.jobs.process(${prefix}_JOB_NAME, async (payload) => {
    const note = typeof payload.note === 'string' ? payload.note : undefined;
    await host.events.emit({
      type: ${prefix}_EVENT_TYPE,
      payload: note ? { note } : {},
    });
  });
  host.automation?.allowedJobs.allow(${prefix}_JOB_NAME);
}
`;
}

function capabilitySource(ids: ProjectIdentifiers): string {
  return `import type { ProblemCapability } from '../host';
import { PROBLEM_PERMISSIONS } from '../permissions';

export const PROBLEM_CAPABILITY: ProblemCapability = {
  name: ${jsString(`problem.${ids.camel}`)},
  version: '0.1.0',
  kind: 'application',
  category: 'core',
  maturity: 'beta',
  summary: ${jsString(`Generated problem module for ${ids.title}. Replace this slot with statement-specific logic.`)},
  dependencies: ['problem.module'],
  optionalDependencies: [],
  conflicts: [],
  environmentRequirements: [],
  infrastructureRequirements: [],
  providerRequirements: [],
  permissions: PROBLEM_PERMISSIONS.map((permission) => permission.key),
  architectureCompatibility: ['architecture.modular-monolith'],
  deploymentCompatibility: ['deployment.local-hybrid', 'deployment.docker-compose'],
  frontendAvailability: true,
  backendAvailability: true,
  workerRequirement: true,
  databaseRequirement: false,
  tests: [
    'modules/problem/src/module.test.ts',
    ${jsString(`modules/problem/src/${ids.slug}/service.test.ts`)},
  ],
  documentation: ['modules/problem/README.md'],
};
`;
}

function frontendIndexSource(ids: ProjectIdentifiers): string {
  return `import { createElement, type ReactElement } from 'react';

import { ${ids.pascal}Page } from './${ids.slug}/${ids.pascal}Page';

export interface ProblemNavItem {
  to: string;
  label: string;
  end?: boolean;
  feature?: string;
}

export interface ProblemRoute {
  path: string;
  element: ReactElement;
}

export const problemNav: ProblemNavItem[] = [{ to: '/problem', label: ${jsString(ids.title)} }];

export const problemRoutes: ProblemRoute[] = [{ path: '/problem', element: createElement(${ids.pascal}Page) }];
`;
}

function frontendApiSource(): string {
  return `import { apiGet } from '@/services/api';

export interface ProblemManifest {
  id: string;
  title: string;
  replaceable: boolean;
  jobName: string;
}

export function getProblemManifest(): Promise<ProblemManifest> {
  return apiGet<ProblemManifest>('/api/v1/problem');
}
`;
}

function frontendPageSource(ids: ProjectIdentifiers): string {
  return `import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '@/services/api';
import { Badge, Breadcrumb, Card, CardHeader, CardTitle, ErrorState, LoadingState, PageContainer } from '@/ui';

import { getProblemManifest } from './api';

interface ManifestState {
  loading: boolean;
  id?: string;
  title?: string;
  error?: string;
}

export function ${ids.pascal}Page() {
  const [state, setState] = useState<ManifestState>({ loading: true });

  useEffect(() => {
    let cancelled = false;

    void getProblemManifest()
      .then((data) => {
        if (!cancelled) {
          setState({ loading: false, id: data.id, title: data.title });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ loading: false, error: getApiErrorMessage(error, 'Problem module is not registered') });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: ${jsString(ids.title)} }]} />}
      title={${jsString(ids.title)}}
      description="This page is registered from the generated problem module. Replace the slot with the hackathon statement."
    >
      <Card>
        <CardHeader>
          <CardTitle>Extension probe</CardTitle>
          {state.id ? <Badge tone="success">{state.id}</Badge> : null}
        </CardHeader>
        {state.loading ? <LoadingState label="Loading problem module…" className="py-4" /> : null}
        {state.error ? <ErrorState message={state.error} /> : null}
        {state.title ? <p className="text-sm text-foreground-muted">{state.title}</p> : null}
      </Card>
    </PageContainer>
  );
}
`;
}

function frontendPageTestSource(ids: ProjectIdentifiers): string {
  return `import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClientProvider, createApiClient } from '@/services/api';
import { ThemeProvider } from '@/ui';

import { ${ids.pascal}Page } from './${ids.pascal}Page';

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe(${jsString(`${ids.pascal}Page`)}, () => {
  it('renders the registered problem module id', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: {
          id: ${jsString(ids.moduleId)},
          title: ${jsString(ids.title)},
          replaceable: true,
          jobName: ${jsString(ids.jobName)},
        },
        meta: {},
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <ApiClientProvider client={createApiClient({ fetchImpl: fetchMock as unknown as typeof fetch })}>
            <${ids.pascal}Page />
          </ApiClientProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(${jsString(ids.moduleId)})).toBeInTheDocument();
    });
    expect(screen.getByText(${jsString(ids.title)})).toBeInTheDocument();
  });
});
`;
}

function odooAdapterSource(): string {
  return `/**
 * Problem-module Odoo adapter slot.
 * Do not import Odoo provider internals or send method names from the client.
 * Fill MODELS with allowlisted technical names after human review.
 */
export const PROBLEM_ODOO_MODELS: readonly string[] = [];

export function hasAllowlistedOdooModel(name: string): boolean {
  return PROBLEM_ODOO_MODELS.includes(name);
}
`;
}

function problemReadme(ids: ProjectIdentifiers, configuration: ProjectConfiguration): string {
  const summary = configuration.problemSummary?.trim() || 'No problem summary was recorded.';
  return `# Problem module (${ids.title})

Generated overlay for \`${ids.moduleId}\`. Copy this folder over the kit \`modules/problem\` workspace only after review. Do not paste it into provider internals.

## Golden path

${summary}

## Register

- HTTP mount: \`/api/v1/problem\`
- Probe: \`GET /api/v1/problem/${ids.slug}\`
- Job: \`${ids.jobName}\`
- Permissions: \`${ids.permissionRead}\`, \`${ids.permissionRun}\`

Call platform services through \`host\`. Do not import Gemini, SMTP, S3, or Odoo client files.
`;
}

const PROBLEM_PACKAGE_JSON = `{
  "name": "@hackathon/problem",
  "version": "0.1.0",
  "private": true,
  "description": "Hackathon-specific extension generated from an approved Project Configuration.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json --watch --preserveWatchOutput",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "express": "^4.21.2",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^24.0.0",
    "@vitest/coverage-v8": "^3.0.8",
    "typescript": "^5.8.2",
    "vitest": "^3.0.8"
  }
}`;

const PROBLEM_TSCONFIG = `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "coverage", "node_modules", "frontend"]
}`;

const PROBLEM_TSCONFIG_BUILD = `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "dist", "coverage", "node_modules", "frontend"]
}`;

const PROBLEM_VITEST = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
});
`;

const PROBLEM_HOST = `import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Structural host the platform passes into \`register()\`.
 * Typed here so this package does not import \`backend/src\` (that would break
 * \`rootDir\` on emit). The API/worker pass a compatible object.
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
  odoo?: unknown;
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
`;
