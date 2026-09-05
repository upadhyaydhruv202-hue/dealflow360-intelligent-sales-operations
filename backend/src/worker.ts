import { loadConfig } from './config';
import { loadEnvFiles } from './config/env';
import { createBackgroundWorker } from './jobs/runtime';
import { createLogger } from './utils/logger';

export function startWorkerProcess(): void {
  loadEnvFiles();
  const config = loadConfig();
  const logger = createLogger(config);
  const worker = createBackgroundWorker({ config, logger });
  const timeoutMs = config.shutdownTimeoutMs;
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      logger.warn({ signal }, 'Workers shutdown already in progress');
      return;
    }

    shuttingDown = true;
    logger.info({ signal }, 'Workers graceful shutdown started');

    const timer = setTimeout(() => {
      logger.error({ timeoutMs }, 'Workers shutdown timed out');
      process.exit(1);
    }, timeoutMs);
    timer.unref();

    try {
      await worker.close();
      clearTimeout(timer);
      logger.info('Workers graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      clearTimeout(timer);
      logger.error({ err: error }, 'Workers graceful shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  worker.start();
}

if (require.main === module) {
  try {
    startWorkerProcess();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start workers';
    console.error(message);
    process.exit(1);
  }
}
