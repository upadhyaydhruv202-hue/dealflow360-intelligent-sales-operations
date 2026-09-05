import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors';
import { PLATFORM_VERSION } from '../capabilities';
import { buildProjectConfiguration } from '../project-planning';
import { FORBIDDEN_PROVIDER_PATH_FRAGMENTS } from './catalog';
import { equivalentGeneratedFiles, generateProject } from './engine';
import { contentDigest } from './identifiers';
import { writeGeneratedProject } from './writer';

const AUTH_STACK = ['auth', 'database', 'infrastructure.postgres'] as const;
const FROZEN = new Date('2026-09-04T12:00:00.000Z');

function approved(input?: { capabilities?: readonly string[]; title?: string; closeDependencies?: boolean }) {
  return buildProjectConfiguration(
    {
      capabilities: [...(input?.capabilities ?? AUTH_STACK)],
      title: input?.title ?? 'Auth Search',
      closeDependencies: input?.closeDependencies,
      architectureMode: 'architecture.modular-monolith',
      deploymentMode: 'deployment.local-hybrid',
    },
    {
      intent: 'approve',
      userId: 'user-1',
      id: () => 'cfg-auth-1',
      now: () => FROZEN,
    },
  );
}

describe('generateProject', () => {
  it('builds an overlay with core, selected capabilities, problem module, tests, and manifests', () => {
    const result = generateProject({ configuration: approved(), now: () => FROZEN });
    const paths = result.files.map((file) => file.path);

    expect(result.projectManifest.platformVersion).toBe(PLATFORM_VERSION);
    expect(result.projectManifest.architectureMode).toBe('architecture.modular-monolith');
    expect(result.projectManifest.deploymentMode).toBe('deployment.local-hybrid');
    expect(result.projectManifest.problemModule).toBe('auth-search');
    expect(result.projectManifest.capabilities).toEqual([...AUTH_STACK].sort());
    expect(result.projectManifest.core).toEqual(expect.arrayContaining(['foundation', 'validation', 'problem.module']));
    expect(Object.values(result.projectManifest.capabilityVersions).every(Boolean)).toBe(true);

    expect(paths).toEqual(expect.arrayContaining([
      'project.manifest.json',
      'generation.manifest.json',
      '.env.example',
      'core/INCLUDED.md',
      'docs/HACKATHON_MODULES.md',
      'registration/routes.json',
      'registration/services.ts',
      'modules/problem/src/module.ts',
      'modules/problem/src/auth-search/service.test.ts',
      'modules/problem/frontend/auth-search/AuthSearchPage.test.tsx',
    ]));
    expect(result.files.some((file) => file.role === 'test')).toBe(true);
    expect(result.generationManifest.wroteProviderInternals).toBe(false);
    expect(result.generationManifest.installedArbitraryPackages).toBe(false);
    expect(result.generationManifest.emittedShellFromAi).toBe(false);
    expect(result.files.every((file) => !FORBIDDEN_PROVIDER_PATH_FRAGMENTS.some((fragment) => file.path.includes(fragment)))).toBe(
      true,
    );
  });

  it('is reproducible: the same approved configuration twice yields equivalent output', () => {
    const configuration = approved();
    const first = generateProject({ configuration, now: () => FROZEN });
    const second = generateProject({ configuration, now: () => FROZEN });

    expect(first.contentDigest).toBe(second.contentDigest);
    expect(first.files.map((file) => `${file.path}:${file.contents}`)).toEqual(
      second.files.map((file) => `${file.path}:${file.contents}`),
    );
    expect(equivalentGeneratedFiles(first.files, second.files)).toBe(true);
  });

  it('keeps content equivalent when only the generation timestamp changes', () => {
    const configuration = approved();
    const first = generateProject({ configuration, now: () => FROZEN });
    const second = generateProject({ configuration, now: () => new Date('2026-09-05T00:00:00.000Z') });

    expect(first.contentDigest).toBe(second.contentDigest);
    expect(equivalentGeneratedFiles(first.files, second.files)).toBe(true);
    expect(first.files.find((file) => file.path === 'generation.manifest.json')?.contents).not.toBe(
      second.files.find((file) => file.path === 'generation.manifest.json')?.contents,
    );
  });

  it('does not change output when proposed capabilities are shuffled', () => {
    const left = generateProject({
      configuration: approved({ capabilities: ['infrastructure.postgres', 'auth', 'database'] }),
      now: () => FROZEN,
    });
    const right = generateProject({
      configuration: approved({ capabilities: ['database', 'infrastructure.postgres', 'auth'] }),
      now: () => FROZEN,
    });
    expect(left.contentDigest).toBe(right.contentDigest);
    expect(equivalentGeneratedFiles(left.files, right.files)).toBe(true);
  });

  it('contentDigest ignores generation.manifest.json', () => {
    const result = generateProject({ configuration: approved(), now: () => FROZEN });
    const withoutManifest = result.files.filter((file) => file.path !== 'generation.manifest.json');
    expect(result.contentDigest).toBe(contentDigest(withoutManifest));
  });

  it('refuses a draft configuration', () => {
    const draft = buildProjectConfiguration(
      { capabilities: [...AUTH_STACK] },
      { intent: 'validate', id: () => 'draft-1' },
    );
    expect(() => generateProject({ configuration: draft })).toThrow(ValidationError);
  });

  it('refuses a tampered digest', () => {
    const configuration = approved();
    configuration.integrity.digest = 'a'.repeat(64);
    expect(() => generateProject({ configuration })).toThrow(/digest/i);
  });

  it('refuses unknown capabilities after re-validation', () => {
    const configuration = approved();
    configuration.proposed.capabilities = ['not-a-real-capability'];
    configuration.integrity.digest = 'b'.repeat(64);
    expect(() => generateProject({ configuration })).toThrow(ValidationError);
  });

  it('rejects arbitrary packages and shell commands from AI-shaped input', () => {
    const configuration = approved();
    expect(() => generateProject({ configuration, packages: ['kafkajs'] })).toThrow(/package/i);
    expect(() => generateProject({ configuration, commands: ['curl http://evil.test'] })).toThrow(/shell/i);
    expect(() => generateProject({ configuration, shell: ['rm -rf /'] })).toThrow(/shell/i);
  });

  it('does not bind a live AI provider when the mock adapter is also selected', () => {
    const configuration = buildProjectConfiguration(
      {
        capabilities: [
          ...AUTH_STACK,
          'ai',
          'ai.guardrails',
          'adapter.ai.mock',
          'adapter.ai.gemini',
        ],
        title: 'AI App',
      },
      { intent: 'approve', id: () => 'cfg-ai', now: () => FROZEN, userId: 'user-1' },
    );
    const result = generateProject({ configuration, now: () => FROZEN });
    const env = result.files.find((file) => file.path === '.env.example')?.contents ?? '';
    expect(env).toContain('AI_PROVIDER=mock');
    expect(env).not.toContain('AI_PROVIDER=gemini');
    expect(env).toContain('FEATURE_AI=true');
  });

  it('adds an Odoo adapter slot only when Odoo is selected, never provider client source', () => {
    const withoutOdoo = generateProject({ configuration: approved(), now: () => FROZEN });
    expect(withoutOdoo.files.some((file) => file.path.endsWith('odoo-adapter.ts'))).toBe(false);

    const withOdoo = generateProject({
      configuration: buildProjectConfiguration(
        {
          capabilities: [...AUTH_STACK, 'odoo', 'adapter.odoo.json2'],
          title: 'Odoo App',
        },
        { intent: 'approve', id: () => 'cfg-odoo', now: () => FROZEN, userId: 'user-1' },
      ),
      now: () => FROZEN,
    });
    expect(withOdoo.files.some((file) => file.path.endsWith('odoo-adapter.ts'))).toBe(true);
    expect(withOdoo.files.some((file) => file.path.includes('odoo.client'))).toBe(false);
  });
});

describe('writeGeneratedProject', () => {
  it('writes twice into an isolated generated/ folder without changing kit source', async () => {
    const kitRoot = await mkdtemp(path.join(os.tmpdir(), 'hsk-gen-'));
    const sourceMarker = path.join(kitRoot, 'backend', 'src', 'keep.txt');
    await mkdir(path.dirname(sourceMarker), { recursive: true });
    await writeFile(sourceMarker, 'untouched\n', 'utf8');
    await writeFile(
      path.join(kitRoot, 'package.json'),
      JSON.stringify({ name: 'hackathon-starter-kit', workspaces: ['backend'] }),
      'utf8',
    );

    const result = generateProject({ configuration: approved(), now: () => FROZEN });
    const outputRoot = path.join(kitRoot, 'generated', 'projects', 'auth-search');
    const first = await writeGeneratedProject(result, { kitRoot, outputRoot });
    const second = await writeGeneratedProject(result, { kitRoot, outputRoot });

    expect(first.dryRun).toBe(false);
    expect(second.files.every((file) => file.status === 'unchanged')).toBe(true);
    expect(await readFile(path.join(outputRoot, 'project.manifest.json'), 'utf8')).toContain('auth-search');
    expect(await readFile(sourceMarker, 'utf8')).toBe('untouched\n');

    await expect(
      writeGeneratedProject(result, { kitRoot, outputRoot: path.join(kitRoot, 'backend', 'src', 'oops') }),
    ).rejects.toThrow(/generated/i);

    await rm(kitRoot, { recursive: true, force: true });
  });
});
