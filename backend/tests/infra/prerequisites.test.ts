import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('prerequisites documentation', () => {
  const doc = readRepoFile('docs/prerequisites.md');
  const pkg = JSON.parse(readRepoFile('package.json')) as {
    engines?: { node?: string; npm?: string };
    packageManager?: string;
  };
  const nvmrc = readRepoFile('.nvmrc').trim();
  const lock = JSON.parse(readRepoFile('package-lock.json')) as {
    lockfileVersion?: number;
    packages?: Record<string, { engines?: { node?: string; npm?: string } }>;
  };
  const backendDocker = readRepoFile('backend/Dockerfile');
  const frontendDocker = readRepoFile('frontend/Dockerfile');
  const infraCompose = readRepoFile('infra/docker-compose.yml');
  const rootCompose = readRepoFile('docker-compose.yml');
  const ci = readRepoFile('.github/workflows/ci.yml');

  it('exists and is linked from the docs index', () => {
    expect(fs.existsSync(path.join(repoRoot, 'docs/prerequisites.md'))).toBe(true);
    expect(readRepoFile('docs/README.md')).toContain('prerequisites.md');
    expect(readRepoFile('docs/README.md')).toContain('VERSION_MATRIX.md');
    expect(readRepoFile('docs/README.md')).toContain('VERSIONING_POLICY.md');
    expect(readRepoFile('docs/getting-started.md')).toContain('prerequisites.md');
    expect(readRepoFile('README.md')).toContain('docs/prerequisites.md');
    expect(fs.existsSync(path.join(repoRoot, 'docs/VERSION_MATRIX.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'docs/VERSIONING_POLICY.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, '.github/dependabot.yml'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, '.npmrc'))).toBe(true);
  });

  it('classifies install kinds used in the kit', () => {
    for (const label of [
      'MANDATORY LOCAL INSTALLATION',
      'DOCKER-PROVIDED',
      'OPTIONAL',
      'CI-ONLY',
      'DEPLOYMENT-ONLY',
      'ONLINE ACCOUNT',
    ]) {
      expect(doc).toContain(label);
    }
  });

  it('cites versions from package.json, nvmrc, lockfile, images, and CI', () => {
    expect(pkg.engines?.node).toBe('^24');
    expect(pkg.engines?.npm).toBe('^11');
    expect(pkg.packageManager).toBe('npm@11.6.2');
    expect(nvmrc).toBe('24');
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.packages?.['']?.engines).toEqual({ node: '^24', npm: '^11' });
    expect(readRepoFile('.npmrc')).toContain('engine-strict=true');
    expect(backendDocker).toContain('FROM node:24-alpine');
    expect(frontendDocker).toContain('FROM node:24-alpine');
    expect(frontendDocker).toContain('nginxinc/nginx-unprivileged:1.27-alpine');
    expect(infraCompose).toContain('postgres:16-alpine');
    expect(infraCompose).toContain('redis:7-alpine');
    expect(ci).toContain('node-version-file: .nvmrc');
    expect(ci).toContain('postgres:16-alpine');
    expect(ci).toContain('redis:7-alpine');
    expect(ci).toContain('ubuntu-24.04');
    expect(ci).toMatch(/run:\s*npm ci/);
    expect(rootCompose).toMatch(/^\s*include:/m);
    expect(rootCompose).toContain('required: false');

    expect(doc).toContain('^24');
    expect(doc).toContain('engines.npm');
    expect(doc).toContain('^11');
    expect(doc).toContain('postgres:16-alpine');
    expect(doc).toContain('redis:7-alpine');
    expect(doc).toContain('node:24-alpine');
    expect(doc).toContain('lockfileVersion');
    expect(doc).toMatch(/v2\.24\+/);
    expect(doc).toContain('nginxinc/nginx-unprivileged:1.27-alpine');
    expect(doc).toContain('VERSION_MATRIX.md');
    expect(readRepoFile('docs/VERSION_MATRIX.md')).toContain('^24');
    expect(readRepoFile('docs/VERSIONING_POLICY.md')).toContain('npm ci');
  });

  it('does not require Python, Yarn, Playwright, or a local Odoo install', () => {
    expect(doc).toMatch(
      /Python is not required|No application or script in this repo requires Python/i,
    );
    expect(doc).toMatch(/Yarn, pnpm, Bun/);
    expect(doc).toMatch(/Playwright, Cypress/);
    expect(doc).toMatch(/Local Odoo/);
  });

  it('includes the hybrid quick-start sequence', () => {
    expect(doc).toMatch(/clone repository/i);
    expect(doc).toMatch(/configure \.env/i);
    expect(doc).toContain('npm install');
    expect(doc).toContain('npm run deps:up');
    expect(doc).toContain('npm run db:migrate');
    expect(doc).toContain('npm run db:seed');
    expect(doc).toContain('npm run dev');
    expect(doc).toContain('/health');
    expect(doc).toContain('/ready');
    expect(doc).toContain('npm test');
  });
});
