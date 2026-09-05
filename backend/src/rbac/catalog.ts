/**
 * Default RBAC catalog. Platform defaults only. Hackathons add keys from
 * `modules/problem` (`permissions` / `rolePermissions` on the problem module).
 * Call requirePermission("inventory.approve") without changing middleware.
 *
 * Role names are stored lowercase (`admin`) and compared case-insensitively, so
 * authorizeRole("ADMIN") and authorizeRole("admin") are the same check.
 *
 * ADMIN is not a middleware bypass. It receives every catalog permission through
 * seed data. Permissions created later must be assigned explicitly.
 */

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  USER: 'user',
} as const;

export type DefaultRoleName = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_WRITE: 'users.write',
  ROLES_READ: 'roles.read',
  ROLES_WRITE: 'roles.write',
  REPORTS_GENERATE: 'reports.generate',
  NOTIFICATIONS_READ: 'notifications.read',
  NOTIFICATIONS_WRITE: 'notifications.write',
  ODOO_READ: 'odoo.read',
  ODOO_WRITE: 'odoo.write',
  AI_USE: 'ai.use',
  COPILOT_USE: 'copilot.use',
  INTENTS_USE: 'intents.use',
  PROBLEM_ANALYZE: 'problem.analyze',
  CAPABILITIES_RECOMMEND: 'capabilities.recommend',
  PROJECTS_PLAN: 'projects.plan',
  PROJECTS_GENERATE: 'projects.generate',
  RAG_USE: 'rag.use',
  SEARCH_USE: 'search.use',
  SEARCH_WRITE: 'search.write',
  ANALYTICS_READ: 'analytics.read',
  ANALYTICS_WRITE: 'analytics.write',
  ANALYTICS_EXPORT: 'analytics.export',
  ANOMALY_USE: 'anomaly.use',
  DOCUMENTS_ANALYZE: 'documents.analyze',
  DOCUMENTS_READ: 'documents.read',
  FILES_READ: 'files.read',
  FILES_WRITE: 'files.write',
  AUTOMATIONS_READ: 'automations.read',
  AUTOMATIONS_WRITE: 'automations.write',
  AUTOMATIONS_EXECUTE: 'automations.execute',
  JOBS_READ: 'jobs.read',
  AUDIT_READ: 'audit.read',
  ADMIN_SETTINGS: 'admin.settings',
} as const;

export type DefaultPermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const DEFAULT_ROLES: ReadonlyArray<{ name: DefaultRoleName; description: string }> = [
  { name: ROLES.ADMIN, description: 'Full access to starter-kit capabilities' },
  { name: ROLES.MANAGER, description: 'Manage users, reports, and notifications' },
  { name: ROLES.STAFF, description: 'Operational access, including Odoo reads' },
  { name: ROLES.USER, description: 'Standard application access without Odoo writes' },
];

export const DEFAULT_PERMISSIONS: ReadonlyArray<{ key: DefaultPermissionKey; description: string }> = [
  { key: PERMISSIONS.USERS_READ, description: 'View users' },
  { key: PERMISSIONS.USERS_WRITE, description: 'Create and update users' },
  { key: PERMISSIONS.ROLES_READ, description: 'View roles and permissions' },
  { key: PERMISSIONS.ROLES_WRITE, description: 'Create roles and assign permissions' },
  { key: PERMISSIONS.REPORTS_GENERATE, description: 'Generate reports' },
  { key: PERMISSIONS.NOTIFICATIONS_READ, description: 'View notifications' },
  { key: PERMISSIONS.NOTIFICATIONS_WRITE, description: 'Create and update notifications' },
  { key: PERMISSIONS.ODOO_READ, description: 'Read Odoo records through the backend adapter' },
  { key: PERMISSIONS.ODOO_WRITE, description: 'Create or modify Odoo records through the backend adapter' },
  { key: PERMISSIONS.AI_USE, description: 'Use AI features' },
  { key: PERMISSIONS.COPILOT_USE, description: 'Use the controlled AI copilot' },
  { key: PERMISSIONS.INTENTS_USE, description: 'Run natural-language business actions through the intent engine' },
  { key: PERMISSIONS.PROBLEM_ANALYZE, description: 'Analyze a hackathon problem statement into a structured specification' },
  { key: PERMISSIONS.CAPABILITIES_RECOMMEND, description: 'Generate advisory capability, profile, and mode recommendations from a structured analysis' },
  { key: PERMISSIONS.PROJECTS_PLAN, description: 'Analyze a problem statement, select capabilities, and approve a validated project configuration' },
  { key: PERMISSIONS.PROJECTS_GENERATE, description: 'Generate an isolated project overlay from an approved project configuration' },
  { key: PERMISSIONS.RAG_USE, description: 'Index documents and run semantic search / RAG answers' },
  { key: PERMISSIONS.SEARCH_USE, description: 'Run keyword, filter, and full-text search' },
  { key: PERMISSIONS.SEARCH_WRITE, description: 'Index and delete search documents' },
  { key: PERMISSIONS.ANALYTICS_READ, description: 'Query registered KPIs, time series, and dashboards' },
  { key: PERMISSIONS.ANALYTICS_WRITE, description: 'Ingest analytics facts for registered KPIs' },
  { key: PERMISSIONS.ANALYTICS_EXPORT, description: 'Export analytics query results' },
  { key: PERMISSIONS.ANOMALY_USE, description: 'Run statistical anomaly detection and read findings' },
  { key: PERMISSIONS.DOCUMENTS_ANALYZE, description: 'Upload and analyze documents with AI' },
  { key: PERMISSIONS.DOCUMENTS_READ, description: 'Read document analysis results' },
  { key: PERMISSIONS.FILES_READ, description: 'Read uploaded files and signed download URLs' },
  { key: PERMISSIONS.FILES_WRITE, description: 'Upload and delete files' },
  { key: PERMISSIONS.AUTOMATIONS_READ, description: 'View automation rules and executions' },
  { key: PERMISSIONS.AUTOMATIONS_WRITE, description: 'Create, update, enable, and disable automation rules' },
  { key: PERMISSIONS.AUTOMATIONS_EXECUTE, description: 'Emit automation events and inbound webhooks' },
  { key: PERMISSIONS.JOBS_READ, description: 'Read background job status' },
  { key: PERMISSIONS.AUDIT_READ, description: 'Read audit events' },
  { key: PERMISSIONS.ADMIN_SETTINGS, description: 'Change administrative settings' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<DefaultRoleName, readonly DefaultPermissionKey[]> = {
  [ROLES.ADMIN]: DEFAULT_PERMISSIONS.map((permission) => permission.key),
  [ROLES.MANAGER]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.REPORTS_GENERATE,
    PERMISSIONS.NOTIFICATIONS_READ,
    PERMISSIONS.NOTIFICATIONS_WRITE,
    PERMISSIONS.ODOO_READ,
    PERMISSIONS.AI_USE,
    PERMISSIONS.COPILOT_USE,
    PERMISSIONS.INTENTS_USE,
    PERMISSIONS.PROBLEM_ANALYZE,
    PERMISSIONS.CAPABILITIES_RECOMMEND,
    PERMISSIONS.PROJECTS_PLAN,
    PERMISSIONS.PROJECTS_GENERATE,
    PERMISSIONS.RAG_USE,
    PERMISSIONS.SEARCH_USE,
    PERMISSIONS.SEARCH_WRITE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_WRITE,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.ANOMALY_USE,
    PERMISSIONS.DOCUMENTS_ANALYZE,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.FILES_READ,
    PERMISSIONS.FILES_WRITE,
    PERMISSIONS.AUTOMATIONS_READ,
    PERMISSIONS.AUTOMATIONS_WRITE,
    PERMISSIONS.AUTOMATIONS_EXECUTE,
    PERMISSIONS.JOBS_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  [ROLES.STAFF]: [
    PERMISSIONS.NOTIFICATIONS_READ,
    PERMISSIONS.ODOO_READ,
    PERMISSIONS.AUTOMATIONS_READ,
    PERMISSIONS.JOBS_READ,
    PERMISSIONS.FILES_READ,
    PERMISSIONS.FILES_WRITE,
    PERMISSIONS.SEARCH_USE,
    PERMISSIONS.ANALYTICS_READ,
  ],
  [ROLES.USER]: [PERMISSIONS.NOTIFICATIONS_READ, PERMISSIONS.FILES_READ, PERMISSIONS.FILES_WRITE],
};
