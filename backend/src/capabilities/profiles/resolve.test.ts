import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../errors';
import { defineCapability } from '../catalog/define';
import { PLATFORM_CAPABILITIES } from '../catalog';
import { defineProfile } from './define';
import { PLATFORM_PROFILES, PROFILE_NAMES, listPlatformProfiles } from './catalog';
import { createPlatformProfileRegistry } from './registry';
import { assertProfileResolution, resolveProfiles } from './resolve';
import { projectProfileSchema } from './schema';
import type { ProjectProfile } from './types';
import type { CapabilityDefinition } from '../types';

function cap(name: string, overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return defineCapability({
    name,
    kind: 'application',
    category: 'core',
    maturity: 'stable',
    summary: `Fixture ${name}`,
    documentation: ['docs/capabilities.md'],
    ...overrides,
  });
}

function profile(
  overrides: Partial<ProjectProfile> & Pick<ProjectProfile, 'name' | 'title'>,
): ProjectProfile {
  return defineProfile({
    maturity: 'stable',
    summary: `Fixture ${overrides.name}`,
    documentation: ['docs/profiles.md'],
    ...overrides,
  });
}

describe('profile resolution', () => {
  it('treats profiles as optional and does not apply a default profile', () => {
    const resolution = resolveProfiles({ selected: [] });

    expect(resolution.valid).toBe(true);
    expect(resolution.profiles).toEqual([]);
    expect(resolution.composed).toEqual([]);
    expect(resolution.selected).toEqual([]);
    expect(resolution.capabilityResolution.selected).toEqual([]);
  });

  it('resolves capabilities directly without any profile', () => {
    const resolution = resolveProfiles({
      selected: ['auth', 'database', 'infrastructure.postgres'],
    });

    expect(resolution.valid).toBe(true);
    expect(resolution.profiles).toEqual([]);
    expect(resolution.inheritedProfiles).toEqual([]);
    expect(resolution.composed).toEqual(['auth', 'database', 'infrastructure.postgres']);
    expect(resolution.capabilityResolution.ordered).toEqual([
      'infrastructure.postgres',
      'database',
      'auth',
    ]);
  });

  it('expands a single profile into its declared capabilities', () => {
    const resolution = resolveProfiles({ profiles: [PROFILE_NAMES.basicWeb] });

    expect(resolution.valid).toBe(true);
    expect(resolution.profiles).toEqual([PROFILE_NAMES.basicWeb]);
    expect(resolution.composed).toContain('auth');
    expect(resolution.composed).toContain('frontend.ui');
    expect(resolution.composed).toContain('infrastructure.postgres');
    expect(resolution.composed).not.toContain('ai');
    expect(resolution.capabilityResolution.valid).toBe(true);
  });

  it('unions multiple profiles deterministically', () => {
    const first = resolveProfiles({
      profiles: [PROFILE_NAMES.odooApplication, PROFILE_NAMES.aiApplication],
    });
    const second = resolveProfiles({
      profiles: [PROFILE_NAMES.aiApplication, PROFILE_NAMES.odooApplication],
    });

    expect(first.valid).toBe(true);
    expect(first.profiles).toEqual(second.profiles);
    expect(first.composed).toEqual(second.composed);
    expect(first.composed).toContain('ai');
    expect(first.composed).toContain('odoo');
    expect(first.composed).toContain('auth');
  });

  it('does not include optional capabilities unless asked', () => {
    const required = resolveProfiles({ profiles: [PROFILE_NAMES.aiApplication] });
    const withOptional = resolveProfiles({
      profiles: [PROFILE_NAMES.aiApplication],
      includeOptional: true,
    });

    expect(required.composed).not.toContain('copilot');
    expect(withOptional.composed).toContain('copilot');
    expect(withOptional.composed).toContain('adapter.ai.mock');
    expect(required.valid).toBe(true);
    expect(withOptional.valid).toBe(true);
  });

  it('reports unknown profiles without inventing capabilities', () => {
    const resolution = resolveProfiles({
      profiles: ['profile.missing'],
      selected: ['foundation'],
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.composed).toEqual(['foundation']);
    expect(resolution.issues.some((issue) => issue.code === 'unknown-profile')).toBe(true);
  });

  it('keeps extra selected capabilities when composing a profile', () => {
    const resolution = resolveProfiles({
      profiles: [PROFILE_NAMES.basicWeb],
      selected: ['email'],
    });

    expect(resolution.valid).toBe(true);
    expect(resolution.composed).toContain('auth');
    expect(resolution.composed).toContain('email');
  });
});

describe('capability inheritance', () => {
  it('inherits capabilities from included profiles', () => {
    const resolution = resolveProfiles({ profiles: [PROFILE_NAMES.aiApplication] });

    expect(resolution.inheritedProfiles).toEqual([PROFILE_NAMES.basicWeb]);
    expect(resolution.expandedProfiles).toEqual([
      PROFILE_NAMES.aiApplication,
      PROFILE_NAMES.basicWeb,
    ]);
    expect(resolution.inheritedCapabilities).toContain('auth');
    expect(resolution.inheritedCapabilities).toContain('ai');
  });

  it('inherits transitively through nested includes', () => {
    const resolution = resolveProfiles({ profiles: [PROFILE_NAMES.enterpriseApplication] });

    expect(resolution.inheritedProfiles).toEqual([
      PROFILE_NAMES.analytics,
      PROFILE_NAMES.automation,
      PROFILE_NAMES.basicWeb,
    ]);
    expect(resolution.composed).toContain('auth');
    expect(resolution.composed).toContain('automation');
    expect(resolution.composed).toContain('reports');
    expect(resolution.composed).toContain('analytics');
    expect(resolution.composed).toContain('audit');
    expect(resolution.composed).toContain('otp');
    expect(resolution.valid).toBe(true);
  });

  it('does not duplicate inherited capability names', () => {
    const resolution = resolveProfiles({
      profiles: [PROFILE_NAMES.enterpriseApplication, PROFILE_NAMES.basicWeb],
    });
    const authCount = resolution.composed.filter((name) => name === 'auth').length;

    expect(authCount).toBe(1);
    expect(resolution.profiles).toEqual([
      PROFILE_NAMES.basicWeb,
      PROFILE_NAMES.enterpriseApplication,
    ]);
  });

  it('reports circular profile includes', () => {
    const catalog = [
      profile({ name: 'profile.loop-a', title: 'Loop A', includes: ['profile.loop-b'] }),
      profile({ name: 'profile.loop-b', title: 'Loop B', includes: ['profile.loop-a'] }),
    ];

    const resolution = resolveProfiles({
      catalog,
      capabilities: [cap('foundation')],
      profiles: ['profile.loop-a'],
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.issues.some((issue) => issue.code === 'circular-profile-include')).toBe(true);
  });
});

describe('conflicts', () => {
  it('reports conflicting profiles once', () => {
    const catalog = [
      profile({
        name: 'profile.left',
        title: 'Left',
        capabilities: ['alpha'],
        conflictingProfiles: ['profile.right'],
      }),
      profile({
        name: 'profile.right',
        title: 'Right',
        capabilities: ['beta'],
        conflictingProfiles: ['profile.left'],
      }),
    ];

    const resolution = resolveProfiles({
      catalog,
      capabilities: [cap('alpha'), cap('beta')],
      profiles: ['profile.right', 'profile.left'],
    });

    const conflicts = resolution.issues.filter((issue) => issue.code === 'profile-conflict');
    expect(resolution.valid).toBe(false);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.profile).toBe('profile.left');
    expect(conflicts[0]?.related).toBe('profile.right');
  });

  it('reports a profile that conflicts with a selected capability', () => {
    const catalog = [
      profile({
        name: 'profile.solo',
        title: 'Solo',
        capabilities: ['alpha'],
        conflicts: ['omega'],
      }),
    ];

    const resolution = resolveProfiles({
      catalog,
      capabilities: [cap('alpha'), cap('omega')],
      profiles: ['profile.solo'],
      selected: ['omega'],
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.issues.some((issue) => issue.code === 'profile-conflict')).toBe(true);
  });

  it('surfaces capability-level conflicts from the composed set', () => {
    const catalog = [
      profile({ name: 'profile.modes', title: 'Modes', capabilities: ['left', 'right'] }),
    ];

    const resolution = resolveProfiles({
      catalog,
      capabilities: [cap('left', { conflicts: ['right'] }), cap('right', { conflicts: ['left'] })],
      profiles: ['profile.modes'],
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.issues.some((issue) => issue.code === 'conflict')).toBe(true);
  });
});

describe('dependencies', () => {
  it('does not auto-enable missing capability dependencies', () => {
    const catalog = [profile({ name: 'profile.thin', title: 'Thin', capabilities: ['auth'] })];
    const capabilities = [
      cap('auth', { dependencies: ['database'] }),
      cap('database', { dependencies: ['infrastructure.postgres'] }),
      cap('infrastructure.postgres', { kind: 'infrastructure', category: 'infrastructure' }),
    ];

    const resolution = resolveProfiles({
      catalog,
      capabilities,
      profiles: ['profile.thin'],
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.composed).toEqual(['auth']);
    expect(resolution.capabilityResolution.missing).toEqual([
      'database',
      'infrastructure.postgres',
    ]);
    expect(resolution.issues.some((issue) => issue.code === 'missing-dependency')).toBe(true);
  });

  it('can close required dependencies when explicitly requested', () => {
    const catalog = [profile({ name: 'profile.thin', title: 'Thin', capabilities: ['auth'] })];
    const capabilities = [
      cap('auth', { dependencies: ['database'] }),
      cap('database', { dependencies: ['infrastructure.postgres'] }),
      cap('infrastructure.postgres', { kind: 'infrastructure', category: 'infrastructure' }),
    ];

    const resolution = resolveProfiles({
      catalog,
      capabilities,
      profiles: ['profile.thin'],
      closeDependencies: true,
    });

    expect(resolution.valid).toBe(true);
    expect(resolution.selected).toEqual(['auth', 'database', 'infrastructure.postgres']);
    expect(resolution.composed).toEqual(['auth']);
  });

  it('records optional dependencies without failing', () => {
    const resolution = resolveProfiles({ profiles: [PROFILE_NAMES.basicWeb] });
    const optional = resolution.capabilityResolution.optionalMissing;

    expect(resolution.valid).toBe(true);
    expect(optional).toContain('otp');
    expect(optional).toContain('infrastructure.redis');
  });
});

describe('version compatibility', () => {
  const baseCaps = [cap('alpha', { version: '0.1.0' }), cap('beta', { version: '0.2.0' })];

  it('accepts matching platform, capability, profile, and plugin versions', () => {
    const catalog = [
      profile({
        name: 'profile.parent',
        title: 'Parent',
        version: '0.1.0',
        capabilities: ['alpha'],
      }),
      profile({
        name: 'profile.child',
        title: 'Child',
        version: '0.1.4',
        includes: ['profile.parent'],
        capabilities: ['beta'],
        compatibility: {
          platform: '>=0.1.0 <1.0.0',
          capabilities: { beta: '^0.2.0' },
          profiles: { 'profile.parent': '^0.1.0' },
          plugins: { 'hackathon.inventory': '^1.0.0' },
        },
      }),
    ];

    const resolution = resolveProfiles({
      catalog,
      capabilities: baseCaps,
      profiles: ['profile.child'],
      platformVersion: '0.1.0',
      plugins: [{ name: 'hackathon.inventory', version: '1.2.0' }],
    });

    expect(resolution.valid).toBe(true);
    expect(resolution.versions.platform).toBe('0.1.0');
    expect(resolution.versions.plugins['hackathon.inventory']).toBe('1.2.0');
    expect(resolution.versions.capabilities.beta).toBe('0.2.0');
  });

  it('rejects an incompatible platform version', () => {
    const catalog = [
      profile({
        name: 'profile.gated',
        title: 'Gated',
        capabilities: ['alpha'],
        compatibility: { platform: '>=2.0.0' },
      }),
    ];

    const resolution = resolveProfiles({
      catalog,
      capabilities: baseCaps,
      profiles: ['profile.gated'],
      platformVersion: '0.1.0',
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.issues.some((issue) => issue.code === 'incompatible-platform-version')).toBe(
      true,
    );
  });

  it('rejects an incompatible capability version', () => {
    const catalog = [
      profile({
        name: 'profile.gated',
        title: 'Gated',
        capabilities: ['beta'],
        compatibility: { capabilities: { beta: '^1.0.0' } },
      }),
    ];

    const resolution = resolveProfiles({
      catalog,
      capabilities: baseCaps,
      profiles: ['profile.gated'],
    });

    expect(resolution.valid).toBe(false);
    expect(
      resolution.issues.some((issue) => issue.code === 'incompatible-capability-version'),
    ).toBe(true);
  });

  it('rejects an incompatible included profile version', () => {
    const catalog = [
      profile({
        name: 'profile.parent',
        title: 'Parent',
        version: '2.0.0',
        capabilities: ['alpha'],
      }),
      profile({
        name: 'profile.child',
        title: 'Child',
        includes: ['profile.parent'],
        compatibility: { profiles: { 'profile.parent': '^0.1.0' } },
      }),
    ];

    const resolution = resolveProfiles({
      catalog,
      capabilities: baseCaps,
      profiles: ['profile.child'],
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.issues.some((issue) => issue.code === 'incompatible-profile-version')).toBe(
      true,
    );
  });

  it('rejects an incompatible plugin version and a missing required plugin', () => {
    const catalog = [
      profile({
        name: 'profile.plug',
        title: 'Plug',
        capabilities: ['alpha'],
        requiredPlugins: ['hackathon.inventory'],
        compatibility: { plugins: { 'hackathon.inventory': '^1.0.0' } },
      }),
    ];

    const missing = resolveProfiles({
      catalog,
      capabilities: baseCaps,
      profiles: ['profile.plug'],
    });
    const wrong = resolveProfiles({
      catalog,
      capabilities: baseCaps,
      profiles: ['profile.plug'],
      plugins: [{ name: 'hackathon.inventory', version: '0.9.0' }],
    });

    expect(missing.valid).toBe(false);
    expect(missing.issues.some((issue) => issue.code === 'missing-plugin')).toBe(true);
    expect(wrong.valid).toBe(false);
    expect(wrong.issues.some((issue) => issue.code === 'incompatible-plugin-version')).toBe(true);
  });
});

describe('unsupported combinations', () => {
  it('rejects kubernetes deployment with a shipped web profile', () => {
    const resolution = resolveProfiles({
      profiles: [PROFILE_NAMES.basicWeb],
      deploymentMode: 'deployment.kubernetes',
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.issues.some((issue) => issue.code === 'unsupported-combination')).toBe(true);
    expect(resolution.issues.some((issue) => issue.code === 'unsupported-deployment-mode')).toBe(
      true,
    );
  });

  it('rejects Cloud-Native plus the unimplemented kubernetes capability', () => {
    const resolution = resolveProfiles({
      profiles: [PROFILE_NAMES.cloudNative],
      includeOptional: true,
    });

    expect(resolution.composed).toContain('deployment.kubernetes');
    expect(resolution.valid).toBe(false);
    expect(
      resolution.issues.some(
        (issue) =>
          issue.code === 'unsupported-combination' && issue.profile === PROFILE_NAMES.cloudNative,
      ),
    ).toBe(true);
  });

  it('rejects experimental profiles when they are not allowed', () => {
    const allowed = resolveProfiles({ profiles: [PROFILE_NAMES.cloudNative] });
    const blocked = resolveProfiles({
      profiles: [PROFILE_NAMES.cloudNative],
      allowMaturities: ['beta', 'stable', 'enterprise'],
    });

    expect(allowed.valid).toBe(true);
    expect(allowed.issues.some((issue) => issue.code === 'unsupported-maturity')).toBe(true);
    expect(blocked.valid).toBe(false);
    expect(
      blocked.issues.some(
        (issue) => issue.code === 'unsupported-maturity' && issue.severity === 'error',
      ),
    ).toBe(true);
  });

  it('rejects deprecated capabilities when they are not allowed', () => {
    const catalog = [
      profile({ name: 'profile.legacy', title: 'Legacy', capabilities: ['legacy'] }),
    ];
    const capabilities = [cap('legacy', { maturity: 'deprecated' })];

    const warned = resolveProfiles({ catalog, capabilities, profiles: ['profile.legacy'] });
    const blocked = resolveProfiles({
      catalog,
      capabilities,
      profiles: ['profile.legacy'],
      allowMaturities: ['stable'],
    });

    expect(warned.valid).toBe(true);
    expect(warned.issues.some((issue) => issue.related === 'deprecated')).toBe(true);
    expect(blocked.valid).toBe(false);
  });

  it('rejects microservices architecture with Basic Web', () => {
    const resolution = resolveProfiles({
      profiles: [PROFILE_NAMES.basicWeb],
      architectureMode: 'architecture.microservices',
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.issues.some((issue) => issue.code === 'unsupported-combination')).toBe(true);
  });
});

describe('platform profile catalog', () => {
  it('registers the twelve composable profiles', () => {
    const names = listPlatformProfiles().map((item) => item.name);
    expect(names).toEqual([
      PROFILE_NAMES.basicWeb,
      PROFILE_NAMES.aiApplication,
      PROFILE_NAMES.odooApplication,
      PROFILE_NAMES.documentIntelligence,
      PROFILE_NAMES.automation,
      PROFILE_NAMES.analytics,
      PROFILE_NAMES.integrationHeavy,
      PROFILE_NAMES.realTime,
      PROFILE_NAMES.dataHeavy,
      PROFILE_NAMES.offlineResilient,
      PROFILE_NAMES.cloudNative,
      PROFILE_NAMES.enterpriseApplication,
    ]);
  });

  it('validates every catalog entry', () => {
    const names = new Set<string>();
    for (const item of PLATFORM_PROFILES) {
      const parsed = projectProfileSchema.parse(item);
      expect(names.has(parsed.name)).toBe(false);
      names.add(parsed.name);
    }
  });

  it('resolves each shipped profile without auto-enabling optional extras', () => {
    for (const item of PLATFORM_PROFILES) {
      const resolution = resolveProfiles({ profiles: [item.name] });
      const errors = resolution.issues.filter((issue) => issue.severity === 'error');
      expect(errors, `${item.name}: ${errors.map((issue) => issue.message).join('; ')}`).toEqual(
        [],
      );
      expect(resolution.valid).toBe(true);
    }
  });

  it('composes the full shipped set without duplicating business logic', () => {
    const resolution = resolveProfiles({
      profiles: PLATFORM_PROFILES.map((item) => item.name),
    });

    expect(resolution.valid).toBe(true);
    expect(resolution.composed).toContain('auth');
    expect(resolution.composed).toContain('ai');
    expect(resolution.composed).toContain('odoo');
    expect(resolution.composed).toContain('automation');
    expect(resolution.composed.filter((name) => name === 'auth')).toHaveLength(1);
    expect(resolution.composed).not.toContain('deployment.kubernetes');
  });

  it('uses enterprise maturity only on the Enterprise Application profile', () => {
    const enterprise = PLATFORM_PROFILES.filter((item) => item.maturity === 'enterprise');
    expect(enterprise.map((item) => item.name)).toEqual([PROFILE_NAMES.enterpriseApplication]);
    expect(PLATFORM_CAPABILITIES.some((item) => item.maturity === 'enterprise')).toBe(false);
  });

  it('exposes the catalog through the profile registry', () => {
    const registry = createPlatformProfileRegistry();
    const resolution = registry.resolve({ profiles: [PROFILE_NAMES.automation] });
    expect(registry.has(PROFILE_NAMES.automation)).toBe(true);
    expect(resolution.valid).toBe(true);
    expect(resolution.composed).toContain('automation');
  });
});

describe('assertProfileResolution', () => {
  it('returns a valid resolution and throws for an invalid one', () => {
    const valid = resolveProfiles({ profiles: [PROFILE_NAMES.basicWeb] });
    expect(assertProfileResolution(valid)).toBe(valid);

    expect(() =>
      assertProfileResolution(resolveProfiles({ profiles: ['profile.missing'] })),
    ).toThrow(ValidationError);
  });
});
