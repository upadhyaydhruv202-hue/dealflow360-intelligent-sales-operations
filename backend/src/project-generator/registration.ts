import type { CapabilityDefinition } from '../capabilities';
import type { ProjectConfiguration } from '../project-planning';
import { stableJson, withTrailingNewline } from './identifiers';
import type { GeneratedFile, ProjectIdentifiers } from './types';

export function generateRegistrationFiles(input: {
  configuration: ProjectConfiguration;
  catalog: Map<string, CapabilityDefinition>;
  identifiers: ProjectIdentifiers;
}): GeneratedFile[] {
  const { configuration, catalog, identifiers } = input;
  const capabilities = configuration.resolved.ordered.map((name) => {
    const capability = catalog.get(name);
    return {
      name,
      version: capability?.version ?? '0.1.0',
      kind: capability?.kind ?? 'application',
      category: capability?.category ?? 'core',
      featureFlag: capability?.featureFlag ?? null,
    };
  });

  const routes = [
    {
      mount: '/api/v1/problem',
      source: `modules/problem/src/${identifiers.slug}/routes.ts`,
      permission: identifiers.permissionRead,
    },
    {
      mount: `/api/v1/problem/${identifiers.slug}`,
      source: `modules/problem/src/${identifiers.slug}/routes.ts`,
      permission: identifiers.permissionRead,
    },
    {
      mount: `/api/v1/problem/${identifiers.slug}/jobs`,
      source: `modules/problem/src/${identifiers.slug}/routes.ts`,
      permission: identifiers.permissionRun,
    },
  ];

  const services = [
    {
      name: 'problemModule',
      register: 'problemModule.register(host)',
      source: 'modules/problem/src/module.ts',
    },
  ];

  const routesTsTyped = withTrailingNewline(`export const PROBLEM_MOUNT = '/problem' as const;

export const GENERATED_ROUTES = ${literal(routes)} as const;

export const GENERATED_SERVICES = ${literal(services)} as const;
`);

  return [
    {
      path: 'registration/capabilities.json',
      contents: stableJson(capabilities),
      role: 'registration',
    },
    {
      path: 'registration/routes.json',
      contents: stableJson(routes),
      role: 'registration',
    },
    {
      path: 'registration/services.json',
      contents: stableJson(services),
      role: 'registration',
    },
    {
      path: 'registration/capabilities.ts',
      contents: withTrailingNewline(
        `export const GENERATED_CAPABILITIES = ${literal(capabilities)} as const;\n`,
      ),
      role: 'registration',
    },
    {
      path: 'registration/routes.ts',
      contents: routesTsTyped,
      role: 'registration',
    },
    {
      path: 'registration/services.ts',
      contents: withTrailingNewline(`export const GENERATED_SERVICES = ${literal(services)} as const;\n`),
      role: 'registration',
    },
  ];
}

function literal(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
