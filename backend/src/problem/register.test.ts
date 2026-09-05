import { Router } from 'express';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../config';
import { createPlatformCapabilityRegistry } from '../capabilities';
import { createEventBus } from '../events';
import { InMemoryJobQueue } from '../jobs';
import { applyProblemModule, mountProblemRouter } from './register';
import type { ProblemHost, ProblemModule } from './types';

const logger = pino({ level: 'silent' });

function host(overrides: Partial<ProblemHost> = {}): ProblemHost {
  return {
    stage: 'api',
    config: loadConfig({ NODE_ENV: 'test' }),
    logger,
    prisma: null,
    jobs: new InMemoryJobQueue(logger),
    events: createEventBus(logger),
    ...overrides,
  };
}

describe('applyProblemModule', () => {
  it('rejects an invalid module id', () => {
    const module: ProblemModule = {
      id: 'Not Valid',
      permissions: [],
      register: vi.fn(),
    };
    expect(() => applyProblemModule(host(), module)).toThrow(/lowercase slug/);
    expect(module.register).not.toHaveBeenCalled();
  });

  it('calls register after validating permissions', () => {
    const register = vi.fn();
    const module: ProblemModule = {
      id: 'inventory',
      permissions: [{ key: 'inventory.approve', description: 'Approve inventory' }],
      register,
    };
    applyProblemModule(host({ mount: () => undefined }), module);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('mounts problem routers under /api/v1', () => {
    const use = vi.fn();
    const router = Router();
    mountProblemRouter({ use })('/problem', router);
    expect(use).toHaveBeenCalledWith('/api/v1/problem', router);
  });

  it('registers declared capabilities onto the host registry', () => {
    const registry = createPlatformCapabilityRegistry();
    const register = vi.fn();
    const module: ProblemModule = {
      id: 'inventory',
      permissions: [{ key: 'inventory.approve', description: 'Approve inventory' }],
      capabilities: [
        {
          name: 'problem.inventory',
          version: '0.1.0',
          kind: 'application',
          category: 'core',
          maturity: 'beta',
          summary: 'Problem-module capability fixture.',
          dependencies: ['problem.module'],
          optionalDependencies: [],
          conflicts: [],
          environmentRequirements: [],
          infrastructureRequirements: [],
          providerRequirements: [],
          permissions: ['inventory.approve'],
          architectureCompatibility: ['architecture.modular-monolith'],
          deploymentCompatibility: ['deployment.local-hybrid', 'deployment.docker-compose'],
          frontendAvailability: false,
          backendAvailability: true,
          workerRequirement: false,
          databaseRequirement: false,
          tests: ['backend/src/problem/register.test.ts'],
          documentation: ['docs/problem-module.md'],
        },
      ],
      register,
    };
    applyProblemModule(host({ capabilities: registry }), module);
    expect(registry.has('problem.inventory')).toBe(true);
    expect(register).toHaveBeenCalledTimes(1);
  });
});
