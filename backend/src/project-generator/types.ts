import type { ProjectConfiguration } from '../project-planning';

export const PROJECT_GENERATOR_VERSION = '1.0.0';
export const PROJECT_MANIFEST_SCHEMA_VERSION = 1 as const;
export const GENERATION_MANIFEST_SCHEMA_VERSION = 1 as const;

export const GENERATED_FILE_ROLES = [
  'core',
  'capability',
  'adapter',
  'problem',
  'config',
  'test',
  'docs',
  'registration',
  'manifest',
] as const;

export type GeneratedFileRole = (typeof GENERATED_FILE_ROLES)[number];

export interface GeneratedFile {
  path: string;
  contents: string;
  role: GeneratedFileRole;
  capability?: string;
}

export interface ProjectIdentifiers {
  slug: string;
  pascal: string;
  camel: string;
  moduleId: string;
  permissionRead: string;
  permissionRun: string;
  jobName: string;
  eventType: string;
  mountPath: string;
  title: string;
}

export const PLATFORM_CORE_CAPABILITIES = [
  'foundation',
  'validation',
  'security',
  'observability',
  'testing',
  'feature-flags',
  'problem.module',
] as const;

export interface ProjectManifest {
  schemaVersion: typeof PROJECT_MANIFEST_SCHEMA_VERSION;
  kind: 'hackathon-generated-project';
  generatorVersion: typeof PROJECT_GENERATOR_VERSION;
  platformVersion: string;
  catalogVersion: string;
  capabilityVersions: Record<string, string>;
  profiles: string[];
  architectureMode: string;
  deploymentMode: string;
  problemModule: string;
  core: string[];
  capabilities: string[];
  adapters: string[];
  infrastructure: string[];
  featureFlags: Record<string, boolean>;
  configurationDigest: string;
  configurationId: string;
}

export interface GenerationFileRecord {
  path: string;
  role: GeneratedFileRole;
  sha256: string;
  bytes: number;
  capability?: string;
}

export interface GenerationManifest {
  schemaVersion: typeof GENERATION_MANIFEST_SCHEMA_VERSION;
  generatorVersion: typeof PROJECT_GENERATOR_VERSION;
  platformVersion: string;
  generatedAt: string;
  mode: 'preview' | 'write';
  isolated: true;
  nonDestructive: true;
  wroteProviderInternals: false;
  installedArbitraryPackages: false;
  emittedShellFromAi: false;
  problemModule: string;
  profiles: string[];
  architectureMode: string;
  deploymentMode: string;
  configurationDigest: string;
  contentDigest: string;
  fileCount: number;
  files: GenerationFileRecord[];
  notes: string[];
}

export interface ProjectGenerationResult {
  files: GeneratedFile[];
  projectManifest: ProjectManifest;
  generationManifest: GenerationManifest;
  contentDigest: string;
  configurationDigest: string;
  identifiers: ProjectIdentifiers;
  rebuilt: ProjectConfiguration;
}

export interface GenerateProjectOptions {
  configuration: ProjectConfiguration;
  now?: () => Date;
  packages?: readonly string[];
  commands?: readonly string[];
  shell?: readonly string[];
}

export interface WriteGeneratedProjectOptions {
  kitRoot: string;
  outputRoot: string;
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface WrittenFileRecord extends GenerationFileRecord {
  status: 'written' | 'unchanged' | 'preview';
}

export interface WriteGeneratedProjectResult {
  outputRoot: string;
  relativeRoot: string;
  dryRun: boolean;
  files: WrittenFileRecord[];
  contentDigest: string;
  configurationDigest: string;
  generationManifest: GenerationManifest;
}
