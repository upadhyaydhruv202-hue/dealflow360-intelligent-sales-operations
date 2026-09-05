import { afterAll, beforeAll, expect, it } from 'vitest';

import { createDatabaseClient, type DatabaseClient } from '../../src/lib/database';
import { describeDatabase, disconnectTestPrisma } from '../helpers/database';

describeDatabase('database connection', () => {
  let client: DatabaseClient;

  beforeAll(() => {
    client = createDatabaseClient({
      url: process.env.DATABASE_URL as string,
      poolMax: 5,
      poolTimeoutSeconds: 10,
    });
  });

  afterAll(async () => {
    await client.close();
    await disconnectTestPrisma();
  });

  it('pings PostgreSQL through Prisma', async () => {
    await expect(client.ping()).resolves.toBeUndefined();
  });
});
