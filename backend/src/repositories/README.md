# Repositories

Persistence access lives here. Repositories own queries, pagination, filtering, and sorting.

Create repositories with `createRepositories(prisma)` or `new UserRepository(db)` (a Prisma client or transaction client).

Shared helpers:

* `parsePagination` / `toPaginatedResult`
* `parseSort` / `toPrismaOrderBy`
* `parseFilters` / `toPrismaWhere`
* `withTransaction` in `backend/src/lib/transaction.ts`

`findByEmailForAuth` and `findByIdWithRoles` exist for the Auth module. `findByIdWithRoles` also loads the permission union used by RBAC. `DocumentRepository` stores source metadata and a separate extraction row. Do not put business logic or HTTP concerns in repositories. Do not add a second query library.
