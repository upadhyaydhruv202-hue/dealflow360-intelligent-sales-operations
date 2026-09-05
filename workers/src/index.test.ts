import { describe, expect, it, vi } from 'vitest';

import { createWorkerRuntime } from './index';

describe('worker runtime', () => {
  it('starts without registered processors', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const onStart = vi.fn();
    const runtime = createWorkerRuntime({
      env: { NODE_ENV: 'test' },
      logger: logger as never,
      exit: vi.fn(),
      onStart,
    });

    runtime.start();
    runtime.start();

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('does not register job processors'),
    );
  });

  it('handles SIGTERM and SIGINT by shutting down once', async () => {
    const exit = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const runtime = createWorkerRuntime({
      env: { NODE_ENV: 'test' },
      logger: logger as never,
      timeoutMs: 1000,
      exit,
    });

    runtime.start();
    await runtime.stop('SIGTERM');
    await runtime.stop('SIGINT');

    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
