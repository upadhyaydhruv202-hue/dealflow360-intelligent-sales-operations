import { createServer } from 'node:http';

import { createApp } from './app';
import { loadConfig } from './config';
import { loadEnvFiles } from './config/env';
import { createDatabaseClient } from './lib/database';
import { createRedisClient } from './lib/redis';
import { syncRbacCatalogIfEnabled } from './rbac';
import { registerGracefulShutdown } from './shutdown/graceful-shutdown';
import type { Closable } from './types/lifecycle';
import { createLogger } from './utils/logger';

export async function startServer(): Promise<void> {
  loadEnvFiles();
  const config = loadConfig();
  const logger = createLogger(config);

  const database = config.databaseUrl
    ? createDatabaseClient({
        url: config.databaseUrl,
        poolMax: config.databasePoolMax,
        poolTimeoutSeconds: config.databasePoolTimeoutSeconds,
      })
    : null;
  const redis = config.redisUrl ? createRedisClient(config.redisUrl) : null;

  if (database) {
    try {
      await syncRbacCatalogIfEnabled({
        config,
        prisma: database.prisma,
        logger,
      });
    } catch (error) {
      logger.warn(
        { err: error },
        'RBAC catalog sync failed; start PostgreSQL and retry, or run npm run db:seed',
      );
    }
  }

  const { app, jobs, scheduler, realtime } = createApp({
    config,
    logger,
    database,
    redis,
  });

  const server = createServer(app);

  const closables: Closable[] = [];
  if (scheduler) closables.push(scheduler);
  closables.push(jobs);
  if (realtime) closables.push(realtime);
  if (database) closables.push(database);
  if (redis) closables.push(redis);

  registerGracefulShutdown({
    server,
    closables,
    logger,
    timeoutMs: config.shutdownTimeoutMs,
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.removeListener('error', reject);
      logger.info(
        {
          host: config.host,
          port: config.port,
          env: config.nodeEnv,
          databaseConfigured: Boolean(config.databaseUrl),
          redisConfigured: Boolean(config.redisUrl),
          demoMode: config.demoMode,
        },
        `${config.app.name} listening`,
      );
      resolve();
    });
  });
}

if (require.main === module) {
  startServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Failed to start server';
    console.error(message);
    process.exit(1);
  });
}

export { getConfig } from './config';
