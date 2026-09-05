import path from 'node:path';

import dotenv from 'dotenv';
import pino from 'pino';

export interface WorkerRuntime {
  start(): void;
  stop(signal: string): Promise<void>;
}

export interface WorkerRuntimeOptions {
  env?: NodeJS.ProcessEnv;
  logger?: pino.Logger;
  timeoutMs?: number;
  exit?: (code: number) => void;
  onStart?: () => void;
}

export function loadWorkerEnv(): void {
  const files = [path.resolve(__dirname, '../../.env'), path.resolve(process.cwd(), '.env')];

  for (const file of files) {
    dotenv.config({ path: file });
  }
}

export function createWorkerRuntime(options: WorkerRuntimeOptions = {}): WorkerRuntime {
  const env = options.env ?? process.env;
  const logger =
    options.logger ??
    pino({
      name: 'workers',
      level: env.LOG_LEVEL ?? 'info',
    });
  const timeoutMs = options.timeoutMs ?? Number(env.SHUTDOWN_TIMEOUT_MS ?? 10_000);
  const exit = options.exit ?? ((code: number) => process.exit(code));

  let started = false;
  let shuttingDown = false;

  return {
    start() {
      if (started) {
        return;
      }

      started = true;
      logger.info(
        {
          env: env.NODE_ENV ?? 'development',
          redisConfigured: Boolean(env.REDIS_URL),
        },
        'Workers lifecycle stub started (no job processors)',
      );
      logger.warn(
        'This package entry does not register job processors. Use backend/src/worker.ts via npm run dev:workers, npm run start -w workers, or the Compose worker service.',
      );
      options.onStart?.();
    },
    async stop(signal: string) {
      if (shuttingDown) {
        logger.warn({ signal }, 'Workers shutdown already in progress');
        return;
      }

      shuttingDown = true;
      logger.info({ signal }, 'Workers graceful shutdown started');

      const timer = setTimeout(() => {
        logger.error({ timeoutMs }, 'Workers shutdown timed out');
        exit(1);
      }, timeoutMs);
      timer.unref();

      try {
        // Queue processors are registered by backend/src/worker.ts (npm run dev:workers).
        clearTimeout(timer);
        logger.info('Workers graceful shutdown complete');
        exit(0);
      } catch (error) {
        clearTimeout(timer);
        logger.error({ err: error }, 'Workers graceful shutdown failed');
        exit(1);
      }
    },
  };
}

export function startWorkers(): WorkerRuntime {
  loadWorkerEnv();
  const runtime = createWorkerRuntime();

  process.on('SIGTERM', () => {
    void runtime.stop('SIGTERM');
  });
  process.on('SIGINT', () => {
    void runtime.stop('SIGINT');
  });

  runtime.start();
  return runtime;
}

if (require.main === module) {
  try {
    startWorkers();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start workers';
    console.error(message);
    process.exit(1);
  }
}
