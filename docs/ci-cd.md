# CI/CD

Reusable GitHub Actions pipelines so a new hackathon can push code, validate it, build images, and optionally deploy without redesigning the workflow.

| Workflow | File                       | When it runs                                                                            |
| -------- | -------------------------- | --------------------------------------------------------------------------------------- |
| CI       | `.github/workflows/ci.yml` | Pull requests, pushes to `main` / `master`, and as a reusable workflow                  |
| CD       | `.github/workflows/cd.yml` | Manual **Run workflow**, or automatically after CI on `main` when `CD_AUTO_DEPLOY=true` |

CI never calls paid SaaS. It uses service containers for Postgres and Redis, mock providers, and GitHub-hosted runners (`ubuntu-24.04`).

Dependabot (`.github/dependabot.yml`) opens weekly PRs for npm, GitHub Actions, Dockerfiles, and Compose files. Version policy: [VERSIONING_POLICY.md](VERSIONING_POLICY.md).

## What a new project gets

1. Push a branch and open a pull request → CI checks out, caches npm, installs, lints, typechecks, runs unit and integration tests, audits, builds frontend and backend, and validates Docker images.
2. Merge to `main` → CI runs again on the default branch.
3. Optionally deploy → **Actions → CD → Run workflow**, or set `CD_AUTO_DEPLOY=true` after configuring a registry and a deploy provider.

The worker process uses the **backend** production image (`CMD ["worker"]`). There is no separate worker Dockerfile.

## CI

Jobs:

- **Verify** — Node 24 from `.nvmrc`, npm cache, `npm ci`, migrate, lint, typecheck, unit tests (with coverage), integration tests, API e2e, secret scan, `npm audit`, frontend build, problem module + backend + workers build. Runners are `ubuntu-24.04`.
- **Docker build validation** — production image builds, Compose data stores, API (wait on `/health` and `/ready` with retries), worker/frontend, then `infra/scripts/smoke.mjs`. Does not use `compose up --wait` on the full stack (GitHub Compose can mark the API unhealthy during migrate/seed).

Postgres (`hackathon_test` / `postgres` / `postgres`) and Redis run as GitHub service containers. Those values are local test credentials, not production secrets.

### Artifacts

Each Verify run uploads `ci-reports-<run_id>` (14 days) when the job succeeds or fails:

- JUnit XML under `backend/reports`, `frontend/reports`, `workers/reports`
- V8 coverage (`coverage/`) from the unit run
- `frontend/dist`, `backend/dist`, `workers/dist`

Compose failures upload `docker-compose-logs-<run_id>`.

Coverage is collected on the unit job so integration results do not overwrite it. For combined coverage locally: `npm run test:coverage`.

### Concurrency

Pull request runs for the same PR cancel older in-progress CI. Pushes to `main` do not cancel, so a `workflow_run` CD trigger can see a finished CI.

### Permissions

`contents: read` only. Checkout uses `persist-credentials: false`.

## CD

Sequence:

```text
test (reusable CI)
  → production Docker images
  → registry push
  → deploy hook
  → health check
```

No cloud vendor is hardcoded. Images go to **GHCR** by default (`ghcr.io/<owner>/<repo>/backend` and `.../frontend`). Override the registry with repository variables and secrets.

Manual dispatch inputs:

| Input         | Purpose                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `environment` | GitHub Environment (`staging` or `production`)                             |
| `ref`         | Commit, tag, or branch to deploy (default: the SHA that triggered the run) |
| `skip_verify` | Skip reusable CI when that revision already passed                         |

Auto-deploy after CI on `main` is **off** until you set `CD_AUTO_DEPLOY=true`. Auto-deploy targets `CD_AUTO_ENVIRONMENT` (default `staging`), not production.

### Concurrency

One deployment at a time per environment (`cd-staging`, `cd-production`). `cancel-in-progress` is **false**, so a second deploy waits instead of killing the one that is applying.

### Permissions

- `contents: read` — checkout
- `packages: write` — push to GHCR
- `id-token: write` — optional OIDC for a cloud account (no long-lived cloud keys in GitHub). Unused unless `DEPLOY_COMMAND` exchanges the token.

### Deploy providers

`infra/scripts/deploy.mjs` reads `DEPLOY_PROVIDER` (repository or environment variable):

| Value            | Behavior                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `none` (default) | Log image names and exit 0. Registry push is the release.                                                                        |
| `webhook`        | `POST` JSON `{ environment, backendImage, frontendImage, gitSha, repository }` to `DEPLOY_WEBHOOK_URL`. Optional `Bearer` token. |
| `command`        | Run `DEPLOY_COMMAND` with image coordinates in the environment.                                                                  |

The backend image is also the worker image. Point your orchestrator at the same tag with the container command `worker`.

### Health check

`infra/scripts/healthcheck.mjs` retries `HEALTHCHECK_URL` then `READYCHECK_URL` (JSON `success` / `data.status` of `ok` or `ready`, or any HTTP 2xx).

- `DEPLOY_PROVIDER=none` (images only): probes are optional; both URLs unset skips the check.
- `webhook` or `command`: at least one probe URL is **required**, so a successful apply cannot skip live verification.

Use Environment-scoped variables so staging and production probes differ.

## GitHub variables and secrets

Set these under **Settings → Secrets and variables → Actions**, and optionally per **Environment**.

### Variables (`vars`)

| Name                      | Default                    | Purpose                                                 |
| ------------------------- | -------------------------- | ------------------------------------------------------- |
| `IMAGE_REGISTRY`          | `ghcr.io`                  | Registry host                                           |
| `IMAGE_PREFIX`            | `ghcr.io/<lowercase repo>` | `prefix/backend` and `prefix/frontend`                  |
| `VITE_API_URL`            | empty                      | Frontend image build-arg (empty = nginx proxies `/api`) |
| `DEPLOY_PROVIDER`         | `none`                     | `none`, `webhook`, or `command`                         |
| `DEPLOY_COMMAND`          | unset                      | Shell command for `command` provider                    |
| `DEPLOY_WEBHOOK_TIMEOUT_MS` | `15000`                  | Webhook POST timeout (`deploy.mjs`)                     |
| `DEPLOY_URL`              | unset                      | Shown on the GitHub Environment                         |
| `HEALTHCHECK_URL`         | unset                      | e.g. `https://api.example.com/health`                   |
| `READYCHECK_URL`          | unset                      | e.g. `https://api.example.com/ready`                    |
| `HEALTHCHECK_RETRIES`     | `12`                       | Probe attempts                                          |
| `HEALTHCHECK_INTERVAL_MS` | `5000`                     | Delay between attempts                                  |
| `HEALTHCHECK_TIMEOUT_MS`  | `5000`                     | Per-probe HTTP timeout                                  |
| `CD_AUTO_DEPLOY`          | unset                      | `true` to deploy after CI on `main`                     |
| `CD_AUTO_ENVIRONMENT`     | `staging`                  | Environment used for auto-deploy                        |
| `AUDIT_CONTINUE_ON_ERROR` | unset (continue)           | Set to `false` to fail CI on `npm audit` high+ findings |

### Secrets (`secrets`)

| Name                   | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `GITHUB_TOKEN`         | Automatic. Used to push GHCR when `REGISTRY_PASSWORD` is unset |
| `REGISTRY_USERNAME`    | Custom registry user (GHCR defaults to `github.actor`)         |
| `REGISTRY_PASSWORD`    | Custom registry password / token                               |
| `DEPLOY_WEBHOOK_URL`   | Webhook endpoint (`webhook` provider)                          |
| `DEPLOY_WEBHOOK_TOKEN` | Optional bearer token for the webhook                          |

Do not put JWT, Odoo, SMTP, AI, or cloud keys in workflow YAML. Application secrets belong in the **hosting environment** (container env, platform secret store), not in the frontend.

OIDC: `id-token: write` lets `DEPLOY_COMMAND` call `aws-actions/configure-aws-credentials` (or Azure/GCP equivalents) **in your command**, without storing cloud access keys in GitHub. This repo does not add those vendor actions.

## GitHub Environments

Create `staging` and `production` environments. For production, enable required reviewers so a dispatch to production waits for approval. Put `HEALTHCHECK_URL`, `DEPLOY_URL`, and webhook secrets on the environment, not only at repository level.

## Image tags

Each push publishes:

- `sha-<7 char rev>` — immutable
- `<environment>` — moving tag (`staging` or `production`)

The worker is `.../backend:sha-<rev>` with command `worker`.

## Rollback

There is no automatic database rollback.

1. In **Packages** (GHCR) or the CD artifact `deploy-images-<run_id>`, find the last good `sha-<rev>`.
2. **Actions → CD → Run workflow**:
   - `ref` = that full commit SHA
   - `environment` = `production` (or `staging`)
   - keep `skip_verify` off unless CI for that SHA already passed
3. The moving tag `<environment>` is updated to the rebuilt images from that commit.
4. If the deploy hook only rolls a tag (no rebuild), set `DEPLOY_COMMAND` / webhook to point the orchestrator at `backend:sha-<old>` and `frontend:sha-<old>`.

Schema changes: Prisma migrations are forward-only in this kit. Restore a database backup taken before the release, or ship a new forward migration. Do not assume `migrate down`.

If a deploy is in progress, wait — concurrency will not cancel it. Start rollback after it finishes or after you have cancelled it in the Actions UI.

## Customization points

Change these without replacing the pipeline:

| Need                           | Where                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Node version                   | `.nvmrc` (currently `24`)                                                                |
| Extra CI commands              | `.github/workflows/ci.yml` Verify steps                                                  |
| Fail the job on audit findings | `AUDIT_CONTINUE_ON_ERROR=false`                                                          |
| Registry other than GHCR       | `IMAGE_REGISTRY`, `IMAGE_PREFIX`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`               |
| Frontend public API URL        | `VITE_API_URL`                                                                           |
| How images go live             | `DEPLOY_PROVIDER` + webhook or `DEPLOY_COMMAND`                                          |
| Probe URLs and retries         | `HEALTHCHECK_*` / `READYCHECK_URL`                                                       |
| Auto-deploy to staging         | `CD_AUTO_DEPLOY=true`                                                                    |
| Production gate                | GitHub Environment required reviewers                                                    |
| Problem-specific tests         | `modules/problem/**/*.test.ts` or workspace test globs (CI already runs workspace tests) |
| Compose smoke targets          | `infra/scripts/smoke.mjs`                                                                |

Do **not** add Fly, AWS ECS, Azure Container Apps, or Kubernetes manifests to the reusable workflows. Encode the vendor in `DEPLOY_COMMAND` or an external webhook owned by the hackathon.

Example `DEPLOY_COMMAND` (repository variable, not committed):

```bash
docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d
```

That file would live in the hackathon fork, not in the generic kit.

## Local equivalents

```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run security:secrets
npm run security:audit
npm run build -w frontend
npm run build -w backend
docker build -f backend/Dockerfile --target production -t hackathon-backend:ci .
docker build -f frontend/Dockerfile --target production -t hackathon-frontend:ci .
docker compose up --build -d --wait postgres redis
docker compose up --build -d --no-deps backend
# Wait until GET /health and GET /ready succeed (CI uses infra/scripts/healthcheck.mjs).
docker compose up --build -d --no-deps worker frontend
npm run docker:smoke
```

`test:integration` exists on the backend workspace (HTTP, Prisma, Redis). Frontend and workers only define `test:unit`.

## Security notes

- Workflows reference `${{ secrets.* }}` and `${{ vars.* }}` only.
- CI service `POSTGRES_PASSWORD=postgres` matches local test Compose; do not reuse it in production.
- `npm audit` may continue on error because of known upstream advisories (see [security.md](security.md)). Flip the variable when you want the gate.
- CD does not inject application secrets into images. Bake only `VITE_API_URL` into the frontend (public).

## Tests

`backend/tests/infra/ci-cd.test.ts` asserts workflow shape, no vendor deploy actions, no hardcoded secret assignments, and the deploy/healthcheck hooks (including webhook POST and retries).
