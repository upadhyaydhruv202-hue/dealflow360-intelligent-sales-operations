# RBAC

Authorization is separate from authentication. Identity comes from `authenticate()`. Access decisions use roles and `resource.action` permissions loaded from PostgreSQL.

```ts
router.get('/reports', authenticate, requirePermission('reports.generate'), controller.generate);
router.delete('/settings', authenticate, authorizeRole('ADMIN'), controller.reset);
```

`authorizeRole("ADMIN")` and `requirePermission("inventory.approve")` do not contain an allowlist. Add permissions in the catalog or via `POST /api/v1/permissions`, assign them to roles, and reuse the same middleware.

Application login does not grant Odoo access. Use `odoo.read` / `odoo.write`.

Frontend checks (`frontend/src/lib/rbac.ts`) are UX only. See [docs/rbac.md](../../../docs/rbac.md).
