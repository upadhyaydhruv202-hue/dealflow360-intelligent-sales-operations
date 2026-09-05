import { describe, expect, it, vi } from 'vitest';

import { DEALFLOW_EVENT_TYPE, DEALFLOW_JOB_NAME, DEALFLOW_PERMISSIONS } from './index';
import { problemModule } from './module';

describe('problemModule', () => {
  it('exports DealFlow360 permissions and a stable id', () => {
    expect(problemModule.id).toBe('dealflow');
    expect(problemModule.permissions).toEqual(DEALFLOW_PERMISSIONS);
    expect(problemModule.capabilities?.[0]?.name).toBe('problem.dealflow');
  });

  it('registers the sync job on every host and mounts HTTP only on the API', () => {
    const process = vi.fn();
    const allow = vi.fn();
    const mount = vi.fn();
    const on = vi.fn();
    const Router = vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
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

    expect(process).toHaveBeenCalledWith(DEALFLOW_JOB_NAME, expect.any(Function));
    expect(allow).toHaveBeenCalledWith(DEALFLOW_JOB_NAME);
    expect(on).toHaveBeenCalledWith(DEALFLOW_EVENT_TYPE, expect.any(Function));
    expect(on).toHaveBeenCalledWith('user.created', expect.any(Function));
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
    expect(mount).toHaveBeenCalledWith('/dealflow', expect.any(Object));
  });
});
