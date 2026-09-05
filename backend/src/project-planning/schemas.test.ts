import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors';
import { parseWithSchema } from '../schemas/parse';
import { projectPlanningAnalyzeBodySchema, projectPlanningSelectionBodySchema } from './schemas';

describe('project planning schemas', () => {
  it('accepts a statement for analyze', () => {
    const parsed = parseWithSchema(projectPlanningAnalyzeBodySchema, {
      statement: 'Staff log in and search records by name.',
      title: 'Search',
    });
    expect(parsed.statement).toContain('search records');
    expect(parsed.title).toBe('Search');
  });

  it('rejects an empty statement', () => {
    expect(() => parseWithSchema(projectPlanningAnalyzeBodySchema, { statement: '  ' })).toThrow(
      ValidationError,
    );
  });

  it('strips client-supplied approved and resolved fields from a selection', () => {
    const parsed = parseWithSchema(projectPlanningSelectionBodySchema, {
      capabilities: ['auth', 'database'],
      profiles: ['profile.basic-web'],
      architectureMode: 'architecture.modular-monolith',
      deploymentMode: 'deployment.local-hybrid',
      approved: true,
      resolved: { capabilities: ['kubernetes'] },
      generatedNothing: false,
    });
    expect(parsed.capabilities).toEqual(['auth', 'database']);
    expect(parsed).not.toHaveProperty('approved');
    expect(parsed).not.toHaveProperty('resolved');
    expect(parsed).not.toHaveProperty('generatedNothing');
  });

  it('rejects an oversized capability list', () => {
    expect(() =>
      parseWithSchema(projectPlanningSelectionBodySchema, {
        capabilities: Array.from({ length: 201 }, (_, index) => `cap-${index}`),
      }),
    ).toThrow(ValidationError);
  });
});
