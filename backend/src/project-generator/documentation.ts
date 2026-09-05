import type { CapabilityDefinition } from '../capabilities';
import type { ProjectConfiguration } from '../project-planning';
import { withTrailingNewline } from './identifiers';
import type { GeneratedFile, ProjectIdentifiers, ProjectManifest } from './types';

export function generateDocumentation(input: {
  configuration: ProjectConfiguration;
  catalog: Map<string, CapabilityDefinition>;
  identifiers: ProjectIdentifiers;
  projectManifest: ProjectManifest;
}): GeneratedFile[] {
  const { configuration, catalog, identifiers, projectManifest } = input;
  return [
    file('README.md', readme(identifiers, projectManifest), 'docs'),
    file('docs/PROBLEM_STATEMENT.md', problemStatement(configuration), 'docs'),
    file('docs/HACKATHON_MODULES.md', modulesDoc(configuration, catalog), 'docs'),
    file('docs/ARCHITECTURE_DECISION.md', architectureDoc(configuration, projectManifest), 'docs'),
    file('docs/REGISTRATION.md', registrationDoc(identifiers, configuration), 'docs'),
    file('docs/CAPABILITIES.md', capabilitiesDoc(configuration, catalog), 'capability'),
    file('docs/ADAPTERS.md', adaptersDoc(configuration, catalog), 'adapter'),
    file('core/INCLUDED.md', coreDoc(projectManifest), 'core'),
  ];
}

function file(path: string, contents: string, role: GeneratedFile['role']): GeneratedFile {
  return { path, contents: withTrailingNewline(contents), role };
}

function readme(identifiers: ProjectIdentifiers, manifest: ProjectManifest): string {
  return `# ${identifiers.title}

Isolated overlay produced by the deterministic project generator.

This directory is **not** a rewrite of the starter kit. Core, selected capabilities, and selected adapters are recorded here and enabled through the generated \`.env.example\`. The problem module is generated. Provider internals are not copied.

## Recorded composition

- Platform version: \`${manifest.platformVersion}\`
- Profiles: ${manifest.profiles.length ? manifest.profiles.map((name) => `\`${name}\``).join(', ') : '(none)'}
- Architecture: \`${manifest.architectureMode}\`
- Deployment: \`${manifest.deploymentMode}\`
- Problem module: \`${manifest.problemModule}\`
- Configuration digest: \`${manifest.configurationDigest}\`

## What to do after review

1. Diff this overlay. Do not copy it blindly onto the kit.
2. Copy accepted \`FEATURE_*\` values from \`.env.example\` into the kit \`.env\` yourself.
3. Replace \`modules/problem\` in the kit only after you accept the generated slot.
4. Run \`npm test\` on the kit. The generator does not execute AI output.

## Safety

- The generator does not modify \`backend/src\`, provider folders, or the kit \`.env\`.
- The generator does not install packages suggested by AI.
- The generator does not emit shell commands from AI output.
`;
}

function problemStatement(configuration: ProjectConfiguration): string {
  const summary = configuration.problemSummary?.trim() || 'No problem summary was recorded on the approved configuration.';
  const requirements = configuration.requirements.length
    ? configuration.requirements
        .map((item) => `- ${item.id}: ${item.requirement}`)
        .join('\n')
    : '- (none extracted)';
  return `# Problem statement

${summary}

## Requirements

${requirements}
`;
}

function modulesDoc(
  configuration: ProjectConfiguration,
  catalog: Map<string, CapabilityDefinition>,
): string {
  const rows = configuration.resolved.ordered
    .map((name) => {
      const capability = catalog.get(name);
      const flag = capability?.featureFlag ? String(capability.featureFlag) : 'always on / no FEATURE_*';
      return `| \`${name}\` | ${capability?.version ?? ''} | ${capability?.kind ?? ''} | ${flag} |`;
    })
    .join('\n');
  return `# Hackathon modules (generated)

Filled from the approved Project Configuration. Enable only these flags in the kit \`.env\`.

| Capability | Version | Kind | Flag |
| --- | --- | --- | --- |
${rows}
`;
}

function architectureDoc(configuration: ProjectConfiguration, manifest: ProjectManifest): string {
  return `# Architecture decision (generated)

## Problem

${configuration.problemSummary?.trim() || '(not recorded)'}

## Core workflow

Login → problem module probe → job \`${manifest.problemModule}\` → visible result.

## Enabled modules and flags

See \`docs/HACKATHON_MODULES.md\`. Architecture \`${manifest.architectureMode}\`. Deployment \`${manifest.deploymentMode}\`.

## Layers

Frontend → /api/v1 → Controller (HTTP + Zod) → Service → Repository | Adapter

Controllers must not query Prisma, call Gemini, or pick Odoo method names from the client.
`;
}

function registrationDoc(identifiers: ProjectIdentifiers, configuration: ProjectConfiguration): string {
  return `# Route and service registration

Review these files before copying the problem module:

- \`registration/routes.json\`
- \`registration/services.json\`
- \`registration/capabilities.json\`

Generated HTTP:

- \`GET /api/v1/problem\`
- \`GET /api/v1/problem/${identifiers.slug}\`
- \`POST /api/v1/problem/${identifiers.slug}/jobs\`

Selected ordered capabilities:

${configuration.resolved.ordered.map((name) => `- \`${name}\``).join('\n')}
`;
}

function capabilitiesDoc(
  configuration: ProjectConfiguration,
  catalog: Map<string, CapabilityDefinition>,
): string {
  const sections = configuration.resolved.capabilities
    .filter((name) => catalog.get(name)?.kind !== 'adapter')
    .map((name) => {
      const capability = catalog.get(name);
      return `## \`${name}\`

- Version: \`${capability?.version ?? 'unknown'}\`
- Kind: \`${capability?.kind ?? 'application'}\`
- Summary: ${capability?.summary ?? ''}
- Tests: ${(capability?.tests ?? []).join(', ') || '(none listed)'}
- Docs: ${(capability?.documentation ?? []).join(', ') || '(none listed)'}
`;
    })
    .join('\n');
  return `# Selected capabilities

${sections || 'No application capabilities were selected.'}
`;
}

function adaptersDoc(
  configuration: ProjectConfiguration,
  catalog: Map<string, CapabilityDefinition>,
): string {
  const sections = configuration.resolved.adapters
    .map((name) => {
      const capability = catalog.get(name);
      return `## \`${name}\`

- Version: \`${capability?.version ?? 'unknown'}\`
- Summary: ${capability?.summary ?? ''}
- Env: ${(capability?.environmentRequirements ?? []).join(', ') || '(none)'}

The generator binds allowlisted environment keys only. It does not copy provider source files.
`;
    })
    .join('\n');
  return `# Selected adapters

${sections || 'No adapters were selected.'}
`;
}

function coreDoc(manifest: ProjectManifest): string {
  return `# Platform core

These modules exist in the starter kit and are recorded on every generated project. They are not copied into this overlay.

${manifest.core.map((name) => `- \`${name}\``).join('\n')}

Platform version: \`${manifest.platformVersion}\`.
`;
}
