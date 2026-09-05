import {
  PLATFORM_CAPABILITIES,
  PLATFORM_VERSION,
  uniqueSortedNames,
} from '../capabilities';
import { ValidationError } from '../errors';
import {
  assertApprovedConfiguration,
  buildProjectConfiguration,
  configurationIntegrity,
} from '../project-planning';
import type { CapabilityDefinition } from '../capabilities';
import type { ProjectConfiguration } from '../project-planning';
import { assertNoArbitraryPackages, assertNoGeneratedCommands, FORBIDDEN_PROVIDER_PATH_FRAGMENTS } from './catalog';
import { generateDocumentation } from './documentation';
import { generateEnvTemplate, generateFeatureFlagRecord } from './env';
import {
  assertRelativeGeneratedPath,
  buildProjectIdentifiers,
  contentDigest,
  sha256Hex,
  stableJson,
} from './identifiers';
import { generateProblemModule } from './problem';
import { generateRegistrationFiles } from './registration';
import {
  GENERATION_MANIFEST_SCHEMA_VERSION,
  PLATFORM_CORE_CAPABILITIES,
  PROJECT_GENERATOR_VERSION,
  PROJECT_MANIFEST_SCHEMA_VERSION,
  type GeneratedFile,
  type GenerateProjectOptions,
  type GenerationManifest,
  type ProjectGenerationResult,
  type ProjectManifest,
} from './types';

export function generateProject(options: GenerateProjectOptions): ProjectGenerationResult {
  assertNoArbitraryPackages(options.packages);
  assertNoGeneratedCommands(options.commands);
  assertNoGeneratedCommands(options.shell);

  const rebuilt = revalidateApprovedConfiguration(options.configuration);
  const catalog = new Map(PLATFORM_CAPABILITIES.map((capability) => [capability.name, capability]));
  const identifiers = buildProjectIdentifiers({
    title: rebuilt.title,
    slug: rebuilt.title,
  });
  const projectManifest = buildProjectManifest(rebuilt, identifiers, catalog);
  const files: GeneratedFile[] = [
    {
      path: 'project.manifest.json',
      contents: stableJson(projectManifest),
      role: 'manifest',
    },
    generateEnvTemplate({ configuration: rebuilt, catalog }),
    ...generateDocumentation({ configuration: rebuilt, catalog, identifiers, projectManifest }),
    ...generateRegistrationFiles({ configuration: rebuilt, catalog, identifiers }),
    ...generateProblemModule({ configuration: rebuilt, identifiers }),
  ];

  const unique = dedupeFiles(files);
  for (const file of unique) {
    assertRelativeGeneratedPath(file.path);
    assertNotProviderInternal(file.path);
  }

  unique.sort((left, right) => left.path.localeCompare(right.path));
  const digest = contentDigest(unique);
  const generatedAt = (options.now?.() ?? new Date()).toISOString();
  const generationManifest = buildGenerationManifest({
    rebuilt,
    identifiers,
    files: unique,
    contentDigest: digest,
    generatedAt,
    mode: 'preview',
  });
  unique.push({
    path: 'generation.manifest.json',
    contents: stableJson(generationManifest),
    role: 'manifest',
  });
  unique.sort((left, right) => left.path.localeCompare(right.path));

  return {
    files: unique,
    projectManifest,
    generationManifest,
    contentDigest: digest,
    configurationDigest: rebuilt.integrity.digest,
    identifiers,
    rebuilt,
  };
}

export function equivalentGeneratedFiles(
  left: readonly GeneratedFile[],
  right: readonly GeneratedFile[],
): boolean {
  const normalize = (files: readonly GeneratedFile[]) =>
    files
      .filter((file) => file.path !== 'generation.manifest.json')
      .map((file) => `${file.path}\n${file.contents}`)
      .sort();
  const leftFiles = normalize(left);
  const rightFiles = normalize(right);
  if (leftFiles.length !== rightFiles.length) {
    return false;
  }
  return leftFiles.every((value, index) => value === rightFiles[index]);
}

export function revalidateApprovedConfiguration(configuration: ProjectConfiguration): ProjectConfiguration {
  if (!configuration?.proposed) {
    throw new ValidationError('Project configuration is missing a proposed selection');
  }
  if (configuration.approved !== true) {
    throw new ValidationError('Project generator requires an approved Project Configuration');
  }
  if (configuration.status && configuration.status !== 'approved') {
    throw new ValidationError('Project generator requires an approved Project Configuration');
  }
  if (configuration.platformVersion && configuration.platformVersion !== PLATFORM_VERSION) {
    throw new ValidationError('Project configuration was approved against a different platform version', {
      expected: PLATFORM_VERSION,
      received: configuration.platformVersion,
    });
  }

  const rebuilt = buildProjectConfiguration(
    {
      title: configuration.title ?? undefined,
      statement: configuration.problemSummary ?? undefined,
      capabilities: configuration.proposed.capabilities,
      profiles: configuration.proposed.profiles,
      architectureMode: configuration.proposed.architectureMode,
      deploymentMode: configuration.proposed.deploymentMode,
      includeOptional: configuration.proposed.includeOptional,
      closeDependencies: configuration.proposed.closeDependencies,
    },
    {
      intent: 'validate',
      id: () => configuration.id,
    },
  );

  if (!rebuilt.validation.valid) {
    throw new ValidationError('Project configuration is not valid and cannot be generated', {
      issues: rebuilt.validation.issues.filter((issue) => issue.severity === 'error'),
    });
  }

  const approvedView: ProjectConfiguration = {
    ...rebuilt,
    status: 'approved',
    approved: true,
    generatedNothing: true,
    title: configuration.title ?? rebuilt.title,
    problemSummary: configuration.problemSummary ?? rebuilt.problemSummary,
    requirements: configuration.requirements?.length ? configuration.requirements : rebuilt.requirements,
    approvedAt: configuration.approvedAt,
    approvedBy: configuration.approvedBy,
  };
  approvedView.integrity.digest = configurationIntegrity(approvedView);
  assertApprovedConfiguration(approvedView);

  if (configuration.integrity?.digest && configuration.integrity.digest !== approvedView.integrity.digest) {
    throw new ValidationError('Project configuration digest does not match the re-resolved selection', {
      expected: approvedView.integrity.digest,
      received: configuration.integrity.digest,
    });
  }

  return approvedView;
}

function buildProjectManifest(
  configuration: ProjectConfiguration,
  identifiers: { moduleId: string },
  catalog: Map<string, CapabilityDefinition>,
): ProjectManifest {
  const capabilityVersions: Record<string, string> = {};
  for (const name of configuration.resolved.ordered) {
    capabilityVersions[name] = catalog.get(name)?.version ?? '0.1.0';
  }
  const selectedCore = configuration.resolved.capabilities.filter(
    (name) =>
      (PLATFORM_CORE_CAPABILITIES as readonly string[]).includes(name) ||
      catalog.get(name)?.category === 'core',
  );
  return {
    schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
    kind: 'hackathon-generated-project',
    generatorVersion: PROJECT_GENERATOR_VERSION,
    platformVersion: PLATFORM_VERSION,
    catalogVersion: configuration.catalogVersion,
    capabilityVersions,
    profiles: [...configuration.resolved.profiles],
    architectureMode: configuration.resolved.architectureMode,
    deploymentMode: configuration.resolved.deploymentMode,
    problemModule: identifiers.moduleId,
    core: uniqueSortedNames([...PLATFORM_CORE_CAPABILITIES, ...selectedCore]),
    capabilities: [...configuration.resolved.capabilities],
    adapters: [...configuration.resolved.adapters],
    infrastructure: [...configuration.resolved.infrastructure],
    featureFlags: generateFeatureFlagRecord({
      configuration,
      catalog,
    }),
    configurationDigest: configuration.integrity.digest,
    configurationId: configuration.id,
  };
}

function buildGenerationManifest(input: {
  rebuilt: ProjectConfiguration;
  identifiers: { moduleId: string };
  files: readonly GeneratedFile[];
  contentDigest: string;
  generatedAt: string;
  mode: 'preview' | 'write';
}): GenerationManifest {
  return {
    schemaVersion: GENERATION_MANIFEST_SCHEMA_VERSION,
    generatorVersion: PROJECT_GENERATOR_VERSION,
    platformVersion: PLATFORM_VERSION,
    generatedAt: input.generatedAt,
    mode: input.mode,
    isolated: true,
    nonDestructive: true,
    wroteProviderInternals: false,
    installedArbitraryPackages: false,
    emittedShellFromAi: false,
    problemModule: input.identifiers.moduleId,
    profiles: [...input.rebuilt.resolved.profiles],
    architectureMode: input.rebuilt.resolved.architectureMode,
    deploymentMode: input.rebuilt.resolved.deploymentMode,
    configurationDigest: input.rebuilt.integrity.digest,
    contentDigest: input.contentDigest,
    fileCount: input.files.length + 1,
    files: input.files.map((file) => ({
      path: file.path,
      role: file.role,
      sha256: sha256Hex(file.contents),
      bytes: Buffer.byteLength(file.contents, 'utf8'),
      ...(file.capability ? { capability: file.capability } : {}),
    })),
    notes: [
      'Overlay only. The starter kit source tree is not modified.',
      'Provider internals are not copied.',
      'FEATURE_* values are written to .env.example in this overlay. They are not applied to the running process.',
    ],
  };
}

export function withWriteMode(result: ProjectGenerationResult, generatedAt: string): ProjectGenerationResult {
  const generationManifest: GenerationManifest = {
    ...result.generationManifest,
    generatedAt,
    mode: 'write',
  };
  const files = result.files
    .filter((file) => file.path !== 'generation.manifest.json')
    .concat({
      path: 'generation.manifest.json',
      contents: stableJson(generationManifest),
      role: 'manifest',
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  return { ...result, files, generationManifest };
}

function dedupeFiles(files: GeneratedFile[]): GeneratedFile[] {
  const byPath = new Map<string, GeneratedFile>();
  for (const file of files) {
    const existing = byPath.get(file.path);
    if (existing && existing.contents !== file.contents) {
      throw new ValidationError('Generator produced conflicting files for the same path', { path: file.path });
    }
    byPath.set(file.path, file);
  }
  return [...byPath.values()];
}

function assertNotProviderInternal(filePath: string): void {
  if (FORBIDDEN_PROVIDER_PATH_FRAGMENTS.some((fragment) => filePath.includes(fragment))) {
    throw new ValidationError('Refusing to write provider internals', { path: filePath });
  }
}
