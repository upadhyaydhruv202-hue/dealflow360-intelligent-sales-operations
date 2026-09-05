import { describe, expect, it } from 'vitest';

import { compareSemver, parseSemver, satisfiesSemver } from './semver';
import {
  PLATFORM_VERSION,
  CAPABILITY_VERSION,
  PROFILE_VERSION,
  PLUGIN_VERSION,
  assertPluginVersion,
  assertProfileVersion,
  isValidSemver,
} from './version';

describe('semver ranges', () => {
  it('parses major.minor.patch and prerelease', () => {
    expect(parseSemver('0.1.0')).toEqual({
      major: 0,
      minor: 1,
      patch: 0,
      prerelease: [],
      raw: '0.1.0',
    });
    expect(parseSemver('1.2.3-beta.1')?.prerelease).toEqual(['beta', 1]);
    expect(parseSemver('v1.0.0')).toBeNull();
  });

  it('orders prerelease below the matching release', () => {
    expect(compareSemver('0.1.0-beta', '0.1.0')).toBeLessThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.2.0', '1.1.9')).toBeGreaterThan(0);
  });

  it('satisfies caret, tilde, and compound ranges', () => {
    expect(satisfiesSemver('0.1.0', '*')).toBe(true);
    expect(satisfiesSemver('0.1.5', '^0.1.0')).toBe(true);
    expect(satisfiesSemver('0.2.0', '^0.1.0')).toBe(false);
    expect(satisfiesSemver('1.2.3', '^1.2.3')).toBe(true);
    expect(satisfiesSemver('2.0.0', '^1.2.3')).toBe(false);
    expect(satisfiesSemver('1.2.9', '~1.2.3')).toBe(true);
    expect(satisfiesSemver('1.3.0', '~1.2.3')).toBe(false);
    expect(satisfiesSemver('0.1.0', '>=0.1.0 <1.0.0')).toBe(true);
    expect(satisfiesSemver('1.0.0', '>=0.1.0 <1.0.0')).toBe(false);
    expect(satisfiesSemver('1.0.0', '^0.1.0 || ^1.0.0')).toBe(true);
    expect(satisfiesSemver('0.1.0-beta', '>=0.1.0')).toBe(false);
  });
});

describe('version constants', () => {
  it('uses valid semver for platform, capability, profile, and plugin versions', () => {
    expect(isValidSemver(PLATFORM_VERSION)).toBe(true);
    expect(isValidSemver(CAPABILITY_VERSION)).toBe(true);
    expect(isValidSemver(PROFILE_VERSION)).toBe(true);
    expect(isValidSemver(PLUGIN_VERSION)).toBe(true);
    expect(assertProfileVersion(PROFILE_VERSION)).toBe(PROFILE_VERSION);
    expect(assertPluginVersion(PLUGIN_VERSION)).toBe(PLUGIN_VERSION);
  });
});
