/** Kit / platform version. Keep aligned with the root package.json version. */
export const PLATFORM_VERSION = '0.1.0';

/** Default version written onto catalog capabilities. Each entry may override. */
export const CAPABILITY_VERSION = '0.1.0';

/** Default version written onto catalog profiles. Each entry may override. */
export const PROFILE_VERSION = '0.1.0';

/** Default version written onto platform plugins when omitted. */
export const PLUGIN_VERSION = '0.1.0';

/** Strict semver: major.minor.patch with optional prerelease. No leading `v`. */
export const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

/** @deprecated Alias of SEMVER_PATTERN. Kept for existing catalog schema imports. */
export const CAPABILITY_VERSION_PATTERN = SEMVER_PATTERN;

export function isValidSemver(version: string): boolean {
  return SEMVER_PATTERN.test(version);
}

export function isValidCapabilityVersion(version: string): boolean {
  return isValidSemver(version);
}

export function isValidProfileVersion(version: string): boolean {
  return isValidSemver(version);
}

export function isValidPluginVersion(version: string): boolean {
  return isValidSemver(version);
}

export function isValidPlatformVersion(version: string): boolean {
  return isValidSemver(version);
}

export function assertSemver(version: string, label = 'version'): string {
  if (!isValidSemver(version)) {
    throw new Error(
      `Invalid ${label} "${version}". Use major.minor.patch (optional -prerelease), without a leading v.`,
    );
  }
  return version;
}

export function assertCapabilityVersion(version: string): string {
  return assertSemver(version, 'capability version');
}

export function assertProfileVersion(version: string): string {
  return assertSemver(version, 'profile version');
}

export function assertPluginVersion(version: string): string {
  return assertSemver(version, 'plugin version');
}

export function assertPlatformVersion(version: string): string {
  return assertSemver(version, 'platform version');
}
