import type { PrismaClient } from '@prisma/client';

import { NotificationRepository } from './notification.repository';
import { PermissionRepository } from './permission.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RoleRepository } from './role.repository';
import { UserRepository } from './user.repository';
import { DocumentRepository } from './document.repository';
import { FileRepository } from './file.repository';
import { CopilotRepository } from './copilot.repository';
import { AuditRepository } from './audit.repository';
import { AutomationRepository } from './automation.repository';
import { RagRepository } from './rag.repository';
import { AnomalyRepository } from './anomaly.repository';
import { SearchRepository } from './search.repository';
import { AnalyticsRepository } from './analytics.repository';
import type { DbClient } from './types';

export function createRepositories(db: DbClient) {
  return {
    users: new UserRepository(db),
    roles: new RoleRepository(db),
    permissions: new PermissionRepository(db),
    notifications: new NotificationRepository(db),
    refreshTokens: new RefreshTokenRepository(db),
    documents: new DocumentRepository(db),
    files: new FileRepository(db),
    copilot: new CopilotRepository(db),
    audit: new AuditRepository(db),
    automation: new AutomationRepository(db),
    rag: new RagRepository(db),
    anomaly: new AnomalyRepository(db),
    search: new SearchRepository(db),
    analytics: new AnalyticsRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export { NotificationRepository } from './notification.repository';
export { PermissionRepository } from './permission.repository';
export { RefreshTokenRepository } from './refresh-token.repository';
export { RoleRepository } from './role.repository';
export { UserRepository } from './user.repository';
export { DocumentRepository } from './document.repository';
export { FileRepository } from './file.repository';
export { CopilotRepository } from './copilot.repository';
export { AuditRepository } from './audit.repository';
export { AutomationRepository } from './automation.repository';
export { RagRepository } from './rag.repository';
export { AnomalyRepository } from './anomaly.repository';
export { SearchRepository } from './search.repository';
export { AnalyticsRepository } from './analytics.repository';
export type { UserWithRoles } from './types';
export {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseFilters,
  parsePagination,
  parseSort,
  toPaginatedResult,
  toPrismaOrderBy,
  toPrismaWhere,
} from './query';
export type { PaginatedResult, PaginationInput, FilterRule } from './query';
export type { PublicUser } from './types';
export type { PrismaClient };
