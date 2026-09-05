import { describe, expect, it } from 'vitest';

import { DatabaseError } from '../../src/errors';
import { createDatabaseClient } from '../../src/lib/database';
import { mapPrismaError } from '../../src/lib/prisma-error';

describe('database failure modes', () => {
  it('fails a ping to an unreachable PostgreSQL without hanging the suite', async () => {
    const client = createDatabaseClient({
      url: 'postgresql://postgres:postgres@127.0.0.1:1/hackathon_test',
      poolMax: 1,
      poolTimeoutSeconds: 2,
    });

    await expect(client.ping()).rejects.toThrow();
    await client.close();
  }, 15_000);

  it('maps unexpected Prisma failures to DatabaseError without leaking internals', () => {
    try {
      mapPrismaError(new Error('ECONNREFUSED 127.0.0.1:5432 password=super-secret'));
      throw new Error('expected DatabaseError');
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseError);
      expect((error as DatabaseError).message).toBe('Database operation failed');
      expect((error as DatabaseError).message).not.toMatch(/super-secret|5432/);
    }
  });
});
