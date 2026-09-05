import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors';
import { parseWithSchema } from '../schemas/parse';
import { analysisSimpleSearch, capabilityRecommendBodySchema } from './index';

describe('capabilityRecommendBodySchema', () => {
  it('accepts a structured analysis from known fixtures', () => {
    const parsed = parseWithSchema(capabilityRecommendBodySchema, {
      analysis: analysisSimpleSearch(),
      title: 'Simple search',
    });
    expect(parsed.analysis.mappings?.length).toBeGreaterThan(0);
    expect(parsed.title).toBe('Simple search');
  });

  it('rejects a missing analysis object', () => {
    expect(() => parseWithSchema(capabilityRecommendBodySchema, { title: 'Nope' })).toThrow(
      ValidationError,
    );
  });

  it('rejects an empty mapping requirement', () => {
    expect(() =>
      parseWithSchema(capabilityRecommendBodySchema, {
        analysis: { mappings: [{ requirement: '  ', category: 'data', confidence: 0.5 }] },
      }),
    ).toThrow(ValidationError);
  });
});
