import { EventEmitter } from 'node:events';
import type { Server } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { createShutdownHandler } from '../src/shutdown/graceful-shutdown';

class FakeServer extends EventEmitter {
  close(callback?: (error?: Error) => void): void {
    callback?.();
  }
}

describe('graceful shutdown', () => {
  it('closes the HTTP server and registered resources', async () => {
    const close = vi.fn(async () => undefined);
    const exit = vi.fn();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const shutdown = createShutdownHandler({
      server: new FakeServer() as unknown as Server,
      closables: [{ name: 'database', close }, { name: 'redis', close }],
      logger: logger as never,
      timeoutMs: 1000,
      exit,
    });

    await shutdown('SIGTERM');

    expect(close).toHaveBeenCalledTimes(2);
    expect(exit).toHaveBeenCalledWith(0);
    expect(logger.info).toHaveBeenCalled();
  });

  it('ignores a second shutdown signal while one is in progress', async () => {
    let finishClose: (() => void) | undefined;
    const server = {
      close: (callback?: (error?: Error) => void) => {
        finishClose = () => callback?.();
      },
    } as unknown as Server;

    const exit = vi.fn();
    const shutdown = createShutdownHandler({
      server,
      closables: [],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      timeoutMs: 1000,
      exit,
    });

    const first = shutdown('SIGTERM');
    await shutdown('SIGINT');
    finishClose?.();
    await first;

    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits with an error when a resource fails to close', async () => {
    const exit = vi.fn();
    const shutdown = createShutdownHandler({
      server: new FakeServer() as unknown as Server,
      closables: [
        {
          name: 'redis',
          close: async () => {
            throw new Error('close failed');
          },
        },
      ],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      timeoutMs: 1000,
      exit,
    });

    await shutdown('SIGTERM');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
