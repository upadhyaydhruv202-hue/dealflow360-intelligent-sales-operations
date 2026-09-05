import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';

import { AuditService, createMemoryAuditStore } from '../audit';
import { AUDIT_ACTIONS } from '../constants';
import { loadConfig } from '../config';
import { FeatureDisabledError, ValidationError } from '../errors';
import { buildProjectConfiguration } from '../project-planning';
import { createProjectGeneratorService } from './index';

const AUTH_STACK = ['auth', 'database', 'infrastructure.postgres'] as const;
const FROZEN = new Date('2026-09-04T12:00:00.000Z');
const temps: string[] = [];

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function kitRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'hsk-gen-svc-'));
  temps.push(dir);
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'hackathon-starter-kit', workspaces: ['backend'] }),
    'utf8',
  );
  return dir;
}

function approved() {
  return buildProjectConfiguration(
    {
      capabilities: [...AUTH_STACK],
      title: 'Auth Search',
      architectureMode: 'architecture.modular-monolith',
      deploymentMode: 'deployment.local-hybrid',
    },
    { intent: 'approve', userId: 'user-1', id: () => 'cfg-auth-1', now: () => FROZEN },
  );
}

describe('ProjectGeneratorService', () => {
  it('previews without writing and generates an isolated overlay with audit', async () => {
    const audit = new AuditService(createMemoryAuditStore());
    const root = await kitRoot();
    const service = createProjectGeneratorService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_PROJECT_GENERATOR: 'true' }),
      logger: pino({ level: 'silent' }),
      audit,
      kitRoot: root,
    });

    const configuration = approved();
    const preview = await service.preview({ configuration, userId: 'user-1' });
    expect(preview.dryRun).toBe(true);
    expect(preview.files.length).toBeGreaterThan(10);
    expect(preview.files.every((file) => file.status === 'preview')).toBe(true);

    const generated = await service.generate({ configuration, userId: 'user-1' });
    expect(generated.dryRun).toBe(false);
    expect(generated.relativeRoot.replaceAll('\\', '/')).toBe('generated/projects/auth-search');
    expect(generated.contentDigest).toBe(preview.contentDigest);

    const previewed = await audit.list({ action: AUDIT_ACTIONS.PROJECT_GENERATOR_PREVIEWED });
    const written = await audit.list({ action: AUDIT_ACTIONS.PROJECT_GENERATOR_GENERATED });
    expect(previewed.items).toHaveLength(1);
    expect(written.items).toHaveLength(1);
    expect(JSON.stringify(written.items[0])).not.toContain('JWT_ACCESS_SECRET=super-secret');
  });

  it('rejects generation when the feature is disabled', async () => {
    const service = createProjectGeneratorService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_PROJECT_GENERATOR: 'false' }),
      logger: pino({ level: 'silent' }),
    });
    await expect(service.preview({ configuration: approved() })).rejects.toBeInstanceOf(FeatureDisabledError);
  });

  it('rejects an unapproved configuration', async () => {
    const service = createProjectGeneratorService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_PROJECT_GENERATOR: 'true' }),
      logger: pino({ level: 'silent' }),
      kitRoot: await kitRoot(),
    });
    const draft = buildProjectConfiguration(
      { capabilities: [...AUTH_STACK] },
      { intent: 'validate', id: () => 'draft-1' },
    );
    await expect(service.generate({ configuration: draft })).rejects.toBeInstanceOf(ValidationError);
  });
});
