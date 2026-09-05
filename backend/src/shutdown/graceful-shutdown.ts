import type { Server } from 'node:http';

import type { Closable } from '../types/lifecycle';
import type { AppLogger } from '../utils/logger';

export interface ShutdownOptions {
  server: Server;
  closables: Closable[];
  logger: AppLogger;
  timeoutMs: number;
  exit?: (code: number) => void;
}

export function createShutdownHandler(options: ShutdownOptions): (signal: string) => Promise<void> {
  let shuttingDown = false;
  const exit = options.exit ?? ((code: number) => process.exit(code));

  return async (signal: string) => {
    if (shuttingDown) {
      options.logger.warn({ signal }, 'Shutdown already in progress');
      return;
    }

    shuttingDown = true;
    options.logger.info({ signal }, 'Graceful shutdown started');

    const timer = setTimeout(() => {
      options.logger.error({ timeoutMs: options.timeoutMs }, 'Graceful shutdown timed out');
      exit(1);
    }, options.timeoutMs);
    timer.unref();

    try {
      await closeHttpServer(options.server);
      options.logger.info('HTTP server closed');

      for (const resource of options.closables) {
        await resource.close();
        options.logger.info({ resource: resource.name }, 'Resource closed');
      }

      clearTimeout(timer);
      options.logger.info('Graceful shutdown complete');
      exit(0);
    } catch (error) {
      clearTimeout(timer);
      options.logger.error({ err: error }, 'Graceful shutdown failed');
      exit(1);
    }
  };
}

export function registerGracefulShutdown(options: ShutdownOptions): (signal: string) => Promise<void> {
  const shutdown = createShutdownHandler(options);

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  return shutdown;
}

function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
