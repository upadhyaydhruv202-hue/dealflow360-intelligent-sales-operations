import { ValidationError } from '../../errors';
import { parseWithSchema } from '../../schemas/parse';
import { PLATFORM_PROFILES } from './catalog';
import { projectProfileSchema } from './schema';
import type { ProfileQuery, ProjectProfile } from './types';
import { resolveProfiles, type ResolveProfilesInput, type ProfileResolution } from './resolve';

export class ProfileRegistry {
  private readonly profiles = new Map<string, ProjectProfile>();

  constructor(initial: readonly ProjectProfile[] = []) {
    for (const profile of initial) {
      this.register(profile);
    }
  }

  register(profile: ProjectProfile): this {
    const parsed = parseWithSchema(projectProfileSchema, profile, {
      source: 'config',
      message: 'Invalid project profile metadata',
    });

    if (this.profiles.has(parsed.name)) {
      throw new ValidationError('Duplicate profile', [
        {
          path: 'config.name',
          message: `Profile "${parsed.name}" is already registered`,
          code: 'custom',
        },
      ]);
    }

    this.profiles.set(parsed.name, parsed);
    return this;
  }

  get(name: string): ProjectProfile | undefined {
    return this.profiles.get(name);
  }

  require(name: string): ProjectProfile {
    const profile = this.profiles.get(name);
    if (!profile) {
      throw new ValidationError('Unknown profile', [
        { path: 'config.name', message: `Profile "${name}" is not registered`, code: 'custom' },
      ]);
    }
    return profile;
  }

  has(name: string): boolean {
    return this.profiles.has(name);
  }

  list(): ProjectProfile[] {
    return [...this.profiles.values()];
  }

  names(): string[] {
    return this.list().map((profile) => profile.name);
  }

  query(query: ProfileQuery = {}): ProjectProfile[] {
    return this.list().filter((profile) => {
      if (query.name && profile.name !== query.name) {
        return false;
      }
      if (query.maturity && profile.maturity !== query.maturity) {
        return false;
      }
      return true;
    });
  }

  /**
   * Compose selected profiles with optional extra capabilities, then validate.
   * Does not enable FEATURE_* or construct services.
   */
  resolve(input: Omit<ResolveProfilesInput, 'catalog'>): ProfileResolution {
    return resolveProfiles({
      ...input,
      catalog: this.list(),
    });
  }

  toJSON(): ProjectProfile[] {
    return this.list();
  }
}

export function createProfileRegistry(profiles: readonly ProjectProfile[] = []): ProfileRegistry {
  return new ProfileRegistry(profiles);
}

export function createPlatformProfileRegistry(): ProfileRegistry {
  return createProfileRegistry(PLATFORM_PROFILES);
}
