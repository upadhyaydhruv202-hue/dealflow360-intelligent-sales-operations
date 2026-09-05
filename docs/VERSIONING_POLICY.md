# Versioning policy

This kit is meant to be cloned months later and still install, migrate, test, and boot. It is **not** future-proof. Libraries, Docker tags, model ids, and Odoo APIs change. This policy says how versions are chosen, when they may change, and what must be re-tested.

Companion table: [VERSION_MATRIX.md](VERSION_MATRIX.md). Install tools: [prerequisites.md](prerequisites.md).

## Package manager

npm is the only package manager. Evidence: root workspaces, committed `package-lock.json` (lockfileVersion 3), CI/Docker `npm ci`, and `package.json` `packageManager`.

Do not add Yarn, pnpm, or Bun lockfiles. Do not run `yarn` / `pnpm` / `bun` against this repo; they will ignore or rewrite the npm lockfile.

`packageManager` records the npm version used to maintain the lockfile (Corepack-compatible). `engines.npm` is the accepted range. `.npmrc` sets `engine-strict=true` and `package-lock=true`.

Install with `npm ci` in CI and production images. Local first-time setup may use `npm install` after clone; if `package-lock.json` would change, stop and investigate.

## Version selection

Choose versions in this order:

1. **What CI and Docker actually run.** `.nvmrc`, Docker `FROM` lines, and Compose image tags are the runtime baseline. A laptop on a newer Node than the images is a mismatch, not a feature.
2. **Long-term support.** Prefer even-numbered Node.js LTS for the runtime. Prefer library majors that the lockfile already satisfies.
3. **One implementation per concern.** Do not add a second ORM, test runner, or CSS framework to “keep current.”
4. **Hackathon cost.** Prefer a slightly older, tested major over a brand-new major that forces a rewrite (Tailwind 4, Prisma 7, React 19).

Caret ranges in `package.json` (`^6.16.2`) allow compatible npm installs. **Reproducibility comes from the lockfile**, not from the range. Never delete `package-lock.json`.

Docker **infrastructure** images use a major (or major.minor) tag, never `latest`:

* `node:24-alpine`
* `postgres:16-alpine`
* `redis:7-alpine`
* `nginxinc/nginx-unprivileged:1.27-alpine`

Those tags still move within the major. That is accepted for local Compose. Production deploys should use the image digest or the `sha-<rev>` tags published by CD.

GitHub Actions majors (`actions/checkout@v7`) also move within the major. Workflows pin the major, not `ubuntu-latest` (runners use `ubuntu-24.04`).

## Upgrade policy

| Kind | When | How |
| --- | --- | --- |
| Patch / minor of an existing major | Security fix, bug blocking the kit, or Dependabot PR that keeps tests green | Merge after CI. Update [VERSION_MATRIX.md](VERSION_MATRIX.md) if the resolved version is a story the docs tell (Node, Prisma, React, Postgres) |
| New **major** of a runtime or framework | Current major is EOL **or** a security issue has no patch on the old major | Dedicated change: read the upstream migration guide, update lockfile, Docker, engines, tests, and docs together. Do not mix with feature work |
| Transitive advisory | `npm audit` / Dependabot | Prefer an upstream fix. Do not `npm audit fix --force` if that downgrades Prisma or jumps a major. See [security.md](security.md) |
| Docker major (Postgres 17, Redis 8, Node 26) | Only with a migration plan | Schema, extensions, and BullMQ compatibility must be checked. Compose, CI services, and docs must move together |
| AI model id | Provider retires the default | Change `AI_DEFAULTS` and docs. Keep the REST adapter; do not add a vendor SDK unless the adapter cannot call the new API |
| Odoo protocol | Upstream removes JSON-2 or XML-RPC | The kit targets Odoo 19 JSON-2. Do not silently fall back to XML-RPC |

Do **not** upgrade a major because it exists. Prisma 7, Express 5, React 19, Vite 7, Tailwind 4, Zod 4, ESLint 10, and Vitest 4 were available at the last audit and were left on purpose.

## Breaking changes

A change is breaking for this kit when it requires more than a lockfile bump, for example:

* Node `engines` / `.nvmrc` / `FROM node:` disagree after the change
* Prisma schema, migrate, or seed behavior changes
* React or Vite plugin APIs change
* Tailwind class or config format changes
* Zod parse API changes
* GitHub Action inputs are renamed or removed

Breaking upgrades must:

1. Stay on a branch.
2. Update every source of truth (engines, nvmrc, Docker, Compose, CI, docs, tests that snapshot those files).
3. Run the [reproducibility checklist](#testing-requirements) below.
4. Record the new baseline in [VERSION_MATRIX.md](VERSION_MATRIX.md).

## Security updates

* Run `npm run security:audit` (`npm audit --omit=dev --audit-level=high`) locally and in CI.
* CI may continue on audit failure (`AUDIT_CONTINUE_ON_ERROR`); set that variable to `false` when the team wants a hard gate.
* Dependabot opens weekly PRs for npm, GitHub Actions, Dockerfiles, and Compose files (`.github/dependabot.yml`).
* Runtime secrets never belong in image tags or workflow YAML. Version pins are not a substitute for [security.md](security.md).

Known pattern: an advisory may only be “fixed” in a **newer major** or an **older** Prisma. Do not force that downgrade. Wait for upstream or isolate the tool (CLI-only) if the vulnerable code does not run in production.

## Dependency review

Before adding a package:

1. Check whether an existing dependency already solves it (`AGENTS.md`).
2. Prefer a maintained library with a clear license.
3. Record new env vars and majors in docs.
4. Commit the lockfile in the same change.

Before merging a version PR, read the diff of `package-lock.json` for unexpected majors and postinstall scripts.

Review **direct** dependencies in workspace `package.json` files. Transitive deprecation notices (for example `glob@10` via dev tooling, ESLint 9 EOL) are tracked in the matrix; they do not by themselves justify a framework rewrite.

## Testing requirements

No version change is done until the relevant slice of this list has been run:

| Change | Minimum verification |
| --- | --- |
| npm patch/minor | `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` |
| Node major | Above, plus `npm run build`, Docker image builds, and Compose smoke if Docker is available |
| Prisma major or Postgres image major | `npm run db:migrate`, `npm run db:test:prepare`, backend integration + e2e |
| Redis / BullMQ major | Redis integration tests under `backend/tests/redis` and `backend/tests/queues` |
| Frontend major (React, Vite, Tailwind) | `npm run build -w frontend`, frontend unit tests, visual check of `/login` and `/ui` |
| GitHub Action major | Workflow YAML review + tests in `backend/tests/infra/ci-cd.test.ts` |
| AI provider/API version | `gemini.provider` unit tests; no live paid calls in CI |
| Odoo protocol | `odoo.client` / `odoo.service` tests; docs in [odoo.md](odoo.md) |

Full clone path (human or CI):

```text
clone
  → Node/npm from .nvmrc + engines
  → npm ci
  → cp .env.example .env
  → docker compose up postgres redis (or full stack)
  → npm run db:migrate
  → npm run db:seed
  → npm test / npm run test:e2e
  → npm run build
  → npm run dev or docker compose up --build
  → GET /health and GET /ready
```

CI already encodes the non-interactive subset (`.github/workflows/ci.yml`).

## Documentation

After a baseline change, update:

* [VERSION_MATRIX.md](VERSION_MATRIX.md)
* [prerequisites.md](prerequisites.md) (if engines, nvmrc, or image tags changed)
* Tests that snapshot those files (`backend/tests/infra/prerequisites.test.ts`, `docker.test.ts`, `ci-cd.test.ts`)

Do not claim the kit will install forever. Claim only that the committed lockfile, image majors, and this policy give the next developer a defined, tested window.
