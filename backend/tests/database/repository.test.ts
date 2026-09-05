import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, expect, it } from 'vitest';

import { ConflictError, ValidationError } from '../../src/errors';
import { MAX_PAGE_SIZE } from '../../src/repositories';
import {
  createTestUser,
  describeDatabase,
  disconnectTestPrisma,
  getTestRepositories,
  resetDatabase,
  TEST_PASSWORD_HASH,
} from '../helpers/database';

describeDatabase('UserRepository', () => {
  let repositories: ReturnType<typeof getTestRepositories>;

  beforeEach(async () => {
    repositories = getTestRepositories();
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('creates and reads a user without exposing the password hash', async () => {
    const created = await repositories.users.create({
      email: 'Person@Example.com',
      displayName: 'Ada Lovelace',
      passwordHash: TEST_PASSWORD_HASH,
    });

    expect(created.email).toBe('person@example.com');
    expect(created).not.toHaveProperty('passwordHash');

    const found = await repositories.users.findById(created.id);
    expect(found?.displayName).toBe('Ada Lovelace');

    const authRecord = await repositories.users.findByEmailForAuth('person@example.com');
    expect(authRecord?.passwordHash).toBe(TEST_PASSWORD_HASH);
  });

  it('rejects a duplicate email with a conflict error', async () => {
    await createTestUser({ email: 'unique@example.com' });

    await expect(createTestUser({ email: 'unique@example.com' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('paginates users with a stable sort', async () => {
    for (const name of ['Ava', 'Bea', 'Cara', 'Dee', 'Eve']) {
      await createTestUser({
        email: `${name.toLowerCase()}@example.com`,
        displayName: name,
      });
    }

    const page = await repositories.users.list({
      page: 2,
      pageSize: 2,
      sortBy: 'displayName',
      sortOrder: 'asc',
    });

    expect(page.items.map((user) => user.displayName)).toEqual(['Cara', 'Dee']);
    expect(page.meta).toMatchObject({
      page: 2,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('filters users by status', async () => {
    await createTestUser({ email: 'active@example.com', status: 'active' });
    await createTestUser({ email: 'disabled@example.com', status: 'disabled' });

    const page = await repositories.users.list({
      filters: [{ field: 'status', operator: 'eq', value: 'disabled' }],
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.email).toBe('disabled@example.com');
  });

  it('rejects invalid pagination input', async () => {
    await expect(repositories.users.list({ page: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(repositories.users.list({ pageSize: MAX_PAGE_SIZE + 1 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rejects unknown sort and filter fields', async () => {
    await expect(repositories.users.list({ sortBy: 'passwordHash' })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      repositories.users.list({
        filters: [{ field: 'passwordHash', operator: 'eq', value: 'secret' }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects values that violate a check constraint', async () => {
    await expect(
      repositories.users.create({
        email: 'not-an-email',
        displayName: 'Broken',
        passwordHash: TEST_PASSWORD_HASH,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describeDatabase('foreign keys', () => {
  let repositories: ReturnType<typeof getTestRepositories>;

  beforeEach(async () => {
    repositories = getTestRepositories();
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('rejects a notification for a missing user', async () => {
    await expect(
      repositories.notifications.create({
        userId: randomUUID(),
        type: 'info',
        title: 'Orphan',
        body: 'This should fail because the user does not exist.',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('allows a notification for an existing user', async () => {
    const user = await createTestUser();
    const notification = await repositories.notifications.create({
      userId: user.id,
      type: 'info',
      title: 'Hello',
      body: 'Example in-app notification.',
    });

    expect(notification.userId).toBe(user.id);
  });
});

describeDatabase('RBAC persistence', () => {
  let repositories: ReturnType<typeof getTestRepositories>;

  beforeEach(async () => {
    repositories = getTestRepositories();
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('unions permissions across multiple roles', async () => {
    const user = await createTestUser();
    const appRole = await repositories.roles.create({
      name: 'user',
      description: 'Application access',
    });
    const staffRole = await repositories.roles.create({
      name: 'staff',
      description: 'Staff access',
    });
    const notifications = await repositories.permissions.create({
      key: 'notifications.read',
      description: 'View notifications',
    });
    const odooRead = await repositories.permissions.create({
      key: 'odoo.read',
      description: 'Read Odoo records',
    });

    await repositories.roles.assignPermission(appRole.id, notifications.id);
    await repositories.roles.assignPermission(staffRole.id, odooRead.id);
    await repositories.roles.assignUser(user.id, appRole.id);
    await repositories.roles.assignUser(user.id, staffRole.id);

    const loaded = await repositories.users.findByIdWithRoles(user.id);
    expect(loaded?.roles).toEqual(['staff', 'user']);
    expect(loaded?.permissions).toEqual(['notifications.read', 'odoo.read']);
  });
});
