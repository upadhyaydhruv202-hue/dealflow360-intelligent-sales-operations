import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const SECRET_ASSIGNMENT =
  /\b(?:JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|OTP_HASH_SECRET|SMTP_PASSWORD|GEMINI_API_KEY|ODOO_API_KEY|RESEND_API_KEY|BREVO_API_KEY|SMS_API_KEY|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID)\s*=\s*\S+/;

describe('Docker Compose stack', () => {
  const compose = readRepoFile('docker-compose.yml');
  const infraCompose = readRepoFile('infra/docker-compose.yml');
  const combined = `${compose}\n${infraCompose}`;

  it('defines the core services and optional nginx profile', () => {
    expect(compose).toMatch(/^name:\s*hackathon-starter-kit/m);
    expect(infraCompose).toMatch(/^name:\s*hackathon-starter-kit/m);
    expect(compose).toMatch(/^\s*include:/m);
    expect(compose).toContain('./infra/docker-compose.yml');
    expect(infraCompose).toMatch(/^\s+postgres:/m);
    expect(infraCompose).toMatch(/^\s+redis:/m);
    expect(compose).toMatch(/^\s+backend:/m);
    expect(compose).toMatch(/^\s+worker:/m);
    expect(compose).toMatch(/^\s+frontend:/m);
    expect(compose).toMatch(/^\s+nginx:/m);
    expect(compose).toMatch(/profiles:\s*\[['"]nginx['"]\]/);
  });

  it('uses service names for in-network database and Redis URLs', () => {
    expect(compose).toMatch(/DATABASE_URL:.*@postgres:5432/);
    expect(compose).toMatch(/REDIS_URL:\s*redis:\/\/redis:6379/);
    expect(compose).not.toMatch(/DATABASE_URL:.*@localhost/);
    expect(compose).not.toMatch(/REDIS_URL:\s*redis:\/\/localhost/);
  });

  it('keeps job consumers on the worker and binds local data stores to loopback', () => {
    expect(compose).toMatch(/JOBS_PROCESS:\s*['"]false['"]/);
    expect(compose).toMatch(/JOBS_PROCESS:\s*['"]true['"]/);
    expect(infraCompose).toContain('127.0.0.1:5433:5432');
    expect(infraCompose).toContain('127.0.0.1:6379:6379');
    expect(compose).toMatch(/JWT_ACCESS_SECRET:\s*\$\{JWT_ACCESS_SECRET:-/);
    expect(compose).toMatch(/JWT_REFRESH_SECRET:\s*\$\{JWT_REFRESH_SECRET:-/);
    expect(compose).toMatch(/STORAGE_SIGNING_SECRET:\s*\$\{STORAGE_SIGNING_SECRET:-/);
  });

  it('declares health checks and healthy startup dependencies', () => {
    for (const service of ['postgres', 'redis', 'backend', 'worker', 'frontend']) {
      expect(combined).toContain(`${service}:`);
    }

    expect(infraCompose).toContain('pg_isready');
    expect(infraCompose).toContain('redis-cli');
    expect(compose).toContain('http-healthcheck.cjs');
    expect(compose).toContain('redis-healthcheck.cjs');
    expect(compose).toContain('condition: service_healthy');
    expect(compose).toMatch(
      /backend:[\s\S]*depends_on:[\s\S]*postgres:[\s\S]*condition: service_healthy/,
    );
    expect(compose).toMatch(
      /worker:[\s\S]*depends_on:[\s\S]*backend:[\s\S]*condition: service_healthy/,
    );
    expect(compose).toMatch(
      /frontend:[\s\S]*depends_on:[\s\S]*backend:[\s\S]*condition: service_healthy/,
    );
  });

  it('persists PostgreSQL data and loads environment files', () => {
    expect(infraCompose).toMatch(/docker-data\/postgres:\/var\/lib\/postgresql\/data/);
    expect(compose).toContain('.env.example');
    expect(compose).toMatch(/path:\s*\.env/);
    expect(compose).toContain('required: false');
  });

  it('keeps deps-only commands on the same Compose project', () => {
    const rootPackage = readRepoFile('package.json');
    expect(rootPackage).toContain('"deps:up": "docker compose up -d postgres redis"');
    expect(rootPackage).toContain('"deps:down": "docker compose stop postgres redis"');
    expect(rootPackage).not.toMatch(/deps:up": "docker compose -f infra/);
  });

  it('does not require Kubernetes manifests', () => {
    const kubernetesHints = ['kind: Deployment', 'apiVersion: apps/', 'kind: HelmChart'];
    for (const hint of kubernetesHints) {
      expect(combined.includes(hint)).toBe(false);
    }
  });
});

describe('Dockerfiles', () => {
  const backendDocker = readRepoFile('backend/Dockerfile');
  const frontendDocker = readRepoFile('frontend/Dockerfile');

  it('use multi-stage builds, non-root users, and no secret assignments', () => {
    expect(backendDocker).toMatch(/FROM node:24-alpine AS deps/);
    expect(backendDocker).toMatch(/FROM node:24-alpine AS production/);
    expect(backendDocker).toMatch(/FROM deps AS development/);
    expect(backendDocker).toMatch(/^USER node$/m);

    expect(frontendDocker).toMatch(/FROM node:24-alpine AS deps/);
    expect(frontendDocker).toMatch(/FROM nginxinc\/nginx-unprivileged:1\.27-alpine AS production/);
    expect(frontendDocker).toMatch(/FROM deps AS development/);

    expect(backendDocker).not.toMatch(SECRET_ASSIGNMENT);
    expect(frontendDocker).not.toMatch(SECRET_ASSIGNMENT);
    expect(readRepoFile('infra/docker/backend-entrypoint.cjs')).not.toMatch(SECRET_ASSIGNMENT);
    expect(backendDocker).not.toMatch(/node:latest/);
    expect(frontendDocker).not.toMatch(/node:latest/);
    expect(readRepoFile('infra/docker-compose.yml')).not.toMatch(/image:\s*['"]?postgres:latest/);
    expect(readRepoFile('infra/docker-compose.yml')).not.toMatch(/image:\s*['"]?redis:latest/);
    expect(readRepoFile('docker-compose.yml')).not.toMatch(/nginx-unprivileged:latest/);
  });

  it('keeps runtime images Alpine-based with Prisma generate in the backend image', () => {
    expect(backendDocker).toContain('npx prisma generate');
    expect(backendDocker).toContain('npm ci --omit=dev');
    expect(backendDocker).toContain('modules/problem');
    expect(backendDocker).toContain('packages/api-contract');
    expect(frontendDocker).toContain('npm run build -w frontend');
    expect(frontendDocker).toContain('modules/problem');
    expect(frontendDocker).toContain('packages/api-contract');
  });

  it('re-resolves the backend hostname from the frontend nginx proxy', () => {
    const frontendNginx = readRepoFile('infra/nginx/frontend.conf');
    expect(frontendNginx).toContain('resolver 127.0.0.11');
    expect(frontendNginx).toContain('$backend_upstream');
    expect(frontendNginx).toContain('location /api/v1/realtime/');
    expect(frontendNginx).toContain('proxy_buffering off');
  });
});

describe('Docker Compose config', () => {
  it('renders a valid merged compose file when Docker is available', () => {
    let output: string;
    try {
      output = execFileSync('docker', ['compose', 'config'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const err = error as { code?: string; stderr?: Buffer | string; message?: string };
      const details = `${err.message ?? ''}\n${err.stderr?.toString() ?? ''}`;
      if (
        err.code === 'ENOENT' ||
        /cannot connect to the docker daemon|error during connect|pipe.*dockerDesktopLinuxEngine/i.test(
          details,
        )
      ) {
        return;
      }
      throw error;
    }

    expect(output).toMatch(/backend:/);
    expect(output).toMatch(/worker:/);
    expect(output).toMatch(/frontend:/);
    expect(output).toMatch(/postgres:/);
    expect(output).toMatch(/redis:/);
    expect(output).toContain('hackathon-backend');
    expect(output).toContain('@postgres:5432');
    expect(output).toContain('redis://redis:6379');
  });
});
