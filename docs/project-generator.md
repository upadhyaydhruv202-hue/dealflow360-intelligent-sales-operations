# Deterministic project generator

Consumes an **approved Project Configuration** and writes an isolated overlay. The backend re-validates the object. The frontend is UX only.

The generator does **not** modify starter-kit source, write the kit `.env`, enable the running process, copy provider internals, emit shell from AI output, or install AI-suggested packages.

See `backend/src/project-generator/`.

## Purpose

Pipeline:

```text
Problem statement
  → Analysis
  → Recommendation
  → Human approval
  → Dependency resolution
  → Project Configuration
  → Generator
  → Generated project
  → Validation
```

Each overlay contains:

* Core (recorded, not copied from `backend/src`)
* Selected capabilities
* Selected adapters (allowlisted env bindings only)
* Problem module
* Configuration (`.env.example`)
* Tests
* Documentation
* `project.manifest.json` and `generation.manifest.json`

## Architecture

```text
POST /api/v1/project-generator/preview
  → authenticate + projects.generate
  → strip client resolved / generation / packages / shell
  → revalidate with buildProjectConfiguration
  → assemble files (pure)
  → no disk write

POST /api/v1/project-generator/generate
  → same validation
  → write under generated/projects/<slug>/
```

AI can recommend. The deterministic generator decides adapters, flags, and files.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_PROJECT_GENERATOR` | `false` | Turns the HTTP API and `/project-generator` UI on. Does **not** require `FEATURE_AI` |

Permission: `projects.generate` (manager and admin after seed).

Output is always under the kit `generated/` directory (gitignored). The generator refuses to write into `backend/`, `frontend/`, `workers/`, `database/`, or `modules/`.

## Public interface

```ts
import { generateProject, writeGeneratedProject } from './project-generator';

const overlay = generateProject({ configuration: approved, now: () => frozenDate });
await writeGeneratedProject(overlay, { kitRoot, outputRoot });
```

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/v1/project-generator/preview` | Bearer + `projects.generate` |
| POST | `/api/v1/project-generator/generate` | Bearer + `projects.generate` |

Body: `{ "configuration": <approved Project Configuration>, "dryRun": false, "overwrite": true }`. Extra keys such as `packages` or `shell` are rejected.

The JSON envelope is `{ success, data }`. `data` includes `files`, `contentDigest`, `configurationDigest`, `relativeRoot`, and `generationManifest`.

## Recorded metadata

Every generated project records:

* platform version
* capability versions
* profiles
* architecture mode
* deployment mode
* problem module id
* configuration digest
* generation timestamp (`generation.manifest.json` only)

`contentDigest` hashes all files except `generation.manifest.json`. Generating the same configuration twice yields the same digest. A changed timestamp does not change `contentDigest`.

## Safety

| Control | Behavior |
| --- | --- |
| Re-validation | `buildProjectConfiguration` + digest check. Do not trust `approved: true` from React |
| Isolated | Writes only under `generated/` |
| Non-destructive | Kit source and provider internals are never targets |
| Dependency-aware | Missing required capabilities fail generation |
| Version-aware | Configuration `platformVersion` must match `PLATFORM_VERSION` |
| Idempotent | A second write with identical bytes is recorded as `unchanged` |
| Packages | Only the existing `@hackathon/problem` allowlist. Kafka/Elasticsearch/Kubernetes are refused |
| Shell | Never generated from AI output. README npm commands are static templates |
| Adapters | Mock wins a provider family when both mock and a live adapter are selected |

## Tests

* Reproducibility, shuffled input, digest tamper, unapproved input, packages/shell (`engine.test.ts`)
* Isolated write, refuse kit source paths (`engine.test.ts`)
* Schema strips `resolved` / `generation` (`schemas.test.ts`)
* Service preview/generate/disabled (`service.test.ts`)
* HTTP: success, `projects.generate` denied, draft rejected, feature disabled (`backend/tests/project-generator.http.test.ts`)
* UI: preview → generate (`frontend/src/pages/ProjectGeneratorPage.test.tsx`)

## Limitations

* The overlay is not a standalone rewrite of the kit. Copy `modules/problem` and `.env.example` flags only after review.
* The generator does not run `npm install` or Docker.
* Kubernetes and microservices remain unimplemented; an approved configuration cannot include them.

## Manual verification

1. Set `FEATURE_PROJECT_GENERATOR=true` and `FEATURE_PROJECT_PLANNING=true`. Restart the API.
2. Sign in as manager/admin (`projects.generate`).
3. Approve a configuration at http://localhost:5173/project-planning.
4. Open http://localhost:5173/project-generator. Preview, then generate.
5. Confirm files exist under `generated/projects/<slug>/` and that `backend/src` is unchanged.
6. Confirm `GET /api/v1/audit` has `project.generator.generated` without secrets or the problem statement.
