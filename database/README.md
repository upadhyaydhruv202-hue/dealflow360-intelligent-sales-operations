# Database

PostgreSQL is the primary persistent database. Prisma is the only ORM/query layer.

This directory holds:

* `prisma/schema.prisma` — models and enums
* `prisma/migrations/` — SQL migrations, including CHECK constraints
* `prisma/seed.ts` — demo users, roles, permissions, and notifications

Application access goes through `backend/src/repositories`. Do not query Prisma from controllers or React.

See [docs/database.md](../docs/database.md) for schema conventions, pooling, indexing, migrations, seeding, and how to add models.
