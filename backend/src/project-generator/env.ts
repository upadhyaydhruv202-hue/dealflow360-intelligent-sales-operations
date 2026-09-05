import { FEATURE_NAMES, FEATURE_REGISTRY } from '../features';
import { isFeatureName } from '../features';
import type { CapabilityDefinition } from '../capabilities';
import type { ProjectConfiguration } from '../project-planning';
import { selectAdapterEnv } from './catalog';
import { withTrailingNewline } from './identifiers';
import type { GeneratedFile } from './types';

export function generateEnvTemplate(input: {
  configuration: ProjectConfiguration;
  catalog: Map<string, CapabilityDefinition>;
}): GeneratedFile {
  const selected = input.configuration.resolved.capabilities;
  const flags = new Map<string, boolean>();
  for (const name of FEATURE_NAMES) {
    flags.set(FEATURE_REGISTRY[name].envVar, false);
  }
  for (const capabilityName of selected) {
    const featureFlag = input.catalog.get(capabilityName)?.featureFlag;
    if (featureFlag && isFeatureName(featureFlag)) {
      flags.set(FEATURE_REGISTRY[featureFlag].envVar, true);
    }
  }

  const adapterBindings = selectAdapterEnv(input.configuration.resolved.adapters);
  const seenKeys = new Set<string>();
  const adapterLines: string[] = [];
  for (const binding of adapterBindings) {
    if (seenKeys.has(binding.key)) {
      continue;
    }
    seenKeys.add(binding.key);
    const comment = binding.secret
      ? `# Secret placeholder only. Never commit a real value. Adapter: ${binding.adapter}`
      : `# Selected adapter: ${binding.adapter}`;
    adapterLines.push(comment, `${binding.key}=${binding.value}`, '');
  }

  const flagLines = [...flags.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([envVar, enabled]) => `${envVar}=${enabled ? 'true' : 'false'}`);

  const contents = withTrailingNewline(
    [
      '# Generated environment template. Copy values you accept into the kit .env.',
      '# The generator does not write the starter kit .env and does not enable the running process.',
      '# Secret values are empty placeholders. Do not paste production credentials into git.',
      '',
      'NODE_ENV=development',
      'DEMO_MODE=true',
      'APP_NAME=Hackathon Starter Kit',
      '',
      '# Required for auth when that capability is selected. Placeholders only.',
      'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hackathon',
      'JWT_ACCESS_SECRET=',
      'JWT_REFRESH_SECRET=',
      '',
      '# Feature flags derived from the approved selection. Unselected flags stay false.',
      ...flagLines,
      '',
      '# Adapter bindings. Mock wins a provider family when both mock and a live adapter were selected.',
      ...adapterLines,
    ].join('\n'),
  );

  return { path: '.env.example', contents, role: 'config' };
}

export function generateFeatureFlagRecord(input: {
  configuration: ProjectConfiguration;
  catalog: Map<string, CapabilityDefinition>;
}): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const name of FEATURE_NAMES) {
    flags[FEATURE_REGISTRY[name].envVar] = false;
  }
  for (const capabilityName of input.configuration.resolved.capabilities) {
    const featureFlag = input.catalog.get(capabilityName)?.featureFlag;
    if (featureFlag && isFeatureName(featureFlag)) {
      flags[FEATURE_REGISTRY[featureFlag].envVar] = true;
    }
  }
  return flags;
}
