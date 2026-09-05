import { afterAll, beforeEach, expect, it } from 'vitest';

import { withTransaction } from '../../src/lib/transaction';
import { UserRepository } from '../../src/repositories';
import {
  describeDatabase,
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
  TEST_PASSWORD_HASH,
} from '../helpers/database';

describeDatabase('transactions', () => {
  let prisma: ReturnType<typeof getTestPrisma>;

  beforeEach(async () => {
    prisma = getTestPrisma();
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('commits when the callback succeeds', async () => {
    const user = await withTransaction(prisma, async (tx) => {
      const users = new UserRepository(tx);
      return users.create({
        email: 'commit@example.com',
        displayName: 'Commit User',
        passwordHash: TEST_PASSWORD_HASH,
      });
    });

    const persisted = await prisma.user.findUnique({ where: { id: user.id } });
    expect(persisted?.email).toBe('commit@example.com');
  });

  it('rolls back when the callback throws', async () => {
    await expect(
      withTransaction(prisma, async (tx) => {
        const users = new UserRepository(tx);
        await users.create({
          email: 'rollback@example.com',
          displayName: 'Rollback User',
          passwordHash: TEST_PASSWORD_HASH,
        });
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    const persisted = await prisma.user.findUnique({ where: { email: 'rollback@example.com' } });
    expect(persisted).toBeNull();
  });
});
