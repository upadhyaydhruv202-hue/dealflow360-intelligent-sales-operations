import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLES } from '../../src/rbac/catalog';
import { seedRbacCatalog } from '../../src/rbac/seed-catalog';
import {
  buildActor,
  buildAuditEvent,
  buildAutomationRule,
  buildDocument,
  buildNotification,
  buildPermission,
  buildRole,
  buildUser,
  createAuditEvent,
  createAutomationRule,
  createDocument,
  createNotification,
  createPermission,
  createRole,
  createUser,
  createUserWithPermissions,
  createUserWithRole,
} from './index';
import {
  describeDatabase,
  disconnectTestPrisma,
  getTestPrisma,
  getTestRepositories,
  resetDatabase,
} from '../helpers/database';

describe('test factories (in-memory)', () => {
  it('builds unique users, roles, and permissions', () => {
    const first = buildUser();
    const second = buildUser({ email: 'Ada@Example.com', status: 'disabled' });
    expect(first.email).not.toBe(second.email);
    expect(second.email).toBe('ada@example.com');
    expect(second.status).toBe('disabled');
    expect(buildRole().name).not.toBe(buildRole().name);
    expect(buildPermission().key).toMatch(/^factory\.item\d+$/);
  });

  it('builds authenticated actors, notifications, rules, documents, and audit events', () => {
    expect(buildActor({ permissions: [PERMISSIONS.AUDIT_READ] }).permissions).toEqual([PERMISSIONS.AUDIT_READ]);
    expect(buildNotification({ userId: 'user-1' }).title).toBe('Factory notification');
    expect(buildAutomationRule({ trigger: 'invoice.overdue' }).trigger).toBe('invoice.overdue');
    expect(buildDocument({ userId: 'user-1' }).checksumSha256).toHaveLength(64);
    expect(buildAuditEvent({ action: 'user.login' }).status).toBe('succeeded');
  });
});

describeDatabase('test factories (PostgreSQL)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('persists users, roles, permissions, notifications, rules, documents, and audit events', async () => {
    const repos = getTestRepositories();
    await seedRbacCatalog(getTestPrisma());

    const user = await createUser(repos, { displayName: 'Factory User' });
    const role = await createRole(repos, { name: 'reviewer' });
    const permission = await createPermission(repos, { key: 'reviews.read' });
    await repos.roles.assignPermission(role.id, permission.id);
    await repos.roles.assignUser(user.id, role.id);

    const notification = await createNotification(repos, { userId: user.id, title: 'Hello' });
    const rule = await createAutomationRule(repos, { createdById: user.id, enabled: true });
    const document = await createDocument(repos, { userId: user.id });
    const audit = await createAuditEvent(repos, { userId: user.id, action: 'user.login' });

    expect(notification.title).toBe('Hello');
    expect(rule.enabled).toBe(true);
    expect(document.userId).toBe(user.id);
    expect(audit.action).toBe('user.login');

    const listed = await repos.audit.list({ actorId: user.id, pageSize: 10 });
    expect(listed.items).toHaveLength(1);

    const withRole = await createUserWithRole(repos, ROLES.MANAGER);
    const loaded = await repos.users.findByIdWithRoles(withRole.id);
    expect(loaded?.roles).toContain(ROLES.MANAGER);

    const custom = await createUserWithPermissions(repos, ['reviews.read']);
    const customLoaded = await repos.users.findByIdWithRoles(custom.id);
    expect(customLoaded?.permissions).toContain('reviews.read');
  });
});
