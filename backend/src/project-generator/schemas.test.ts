import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors';
import { parseWithSchema } from '../schemas/parse';
import { projectGeneratorBodySchema } from './schemas';

describe('project generator schemas', () => {
  it('accepts an approved configuration and strips extra resolved fields', () => {
    const parsed = parseWithSchema(projectGeneratorBodySchema, {
      configuration: {
        approved: true,
        status: 'approved',
        proposed: {
          capabilities: ['auth', 'database'],
          profiles: [],
          architectureMode: 'architecture.modular-monolith',
          deploymentMode: 'deployment.local-hybrid',
          includeOptional: false,
          closeDependencies: false,
        },
        integrity: { algorithm: 'sha256', digest: 'a'.repeat(64) },
        resolved: { capabilities: ['deployment.kubernetes'] },
        generation: { allowed: true, attempted: true },
      },
      dryRun: true,
    });
    expect(parsed.configuration.approved).toBe(true);
    expect(parsed.configuration.proposed.capabilities).toEqual(['auth', 'database']);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.configuration).not.toHaveProperty('resolved');
    expect(parsed.configuration).not.toHaveProperty('generation');
  });

  it('rejects shell, packages, and unapproved blobs', () => {
    expect(() =>
      parseWithSchema(projectGeneratorBodySchema, {
        configuration: {
          approved: true,
          proposed: {
            capabilities: ['auth'],
            profiles: [],
            architectureMode: 'architecture.modular-monolith',
            deploymentMode: 'deployment.local-hybrid',
            includeOptional: false,
            closeDependencies: false,
          },
        },
        packages: ['kafkajs'],
      }),
    ).toThrow(ValidationError);

    expect(() =>
      parseWithSchema(projectGeneratorBodySchema, {
        configuration: {
          approved: false,
          proposed: {
            capabilities: ['auth'],
            profiles: [],
            architectureMode: 'architecture.modular-monolith',
            deploymentMode: 'deployment.local-hybrid',
            includeOptional: false,
            closeDependencies: false,
          },
        },
      }),
    ).toThrow(ValidationError);
  });
});
