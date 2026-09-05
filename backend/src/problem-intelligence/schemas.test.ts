import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors';
import { parseAiOutput } from '../schemas/parse';
import { buildProblemIntelligenceDraft } from './fixtures';
import { problemIntelligenceAnalyzeBodySchema, problemIntelligenceDraftSchema } from './schemas';

describe('problemIntelligenceDraftSchema', () => {
  it('accepts a complete structured draft', () => {
    const parsed = parseAiOutput(problemIntelligenceDraftSchema, buildProblemIntelligenceDraft());
    expect(parsed.problemSummary).toContain('Staff log in');
    expect(parsed.mappings).toHaveLength(2);
    expect(parsed.odooRequirements).toBe('unknown');
  });

  it('rejects malformed AI JSON objects', () => {
    expect(() => parseAiOutput(problemIntelligenceDraftSchema, 'not-json')).toThrow(ValidationError);
    expect(() => parseAiOutput(problemIntelligenceDraftSchema, [])).toThrow(ValidationError);
  });

  it('rejects missing required fields instead of inventing them', () => {
    const missingSummary = buildProblemIntelligenceDraft();
    delete (missingSummary as { problemSummary?: string }).problemSummary;
    expect(() => parseAiOutput(problemIntelligenceDraftSchema, missingSummary)).toThrow(ValidationError);

    const missingMappings = buildProblemIntelligenceDraft();
    delete (missingMappings as { mappings?: unknown }).mappings;
    expect(() => parseAiOutput(problemIntelligenceDraftSchema, missingMappings)).toThrow(ValidationError);

    const missingConfidence = buildProblemIntelligenceDraft();
    delete (missingConfidence as { confidence?: number }).confidence;
    expect(() => parseAiOutput(problemIntelligenceDraftSchema, missingConfidence)).toThrow(ValidationError);
  });

  it('treats omitted optional sections as unknown', () => {
    const draft = buildProblemIntelligenceDraft();
    const record = draft as unknown as Record<string, unknown>;
    delete record.odooRequirements;
    delete record.integrations;
    const parsed = parseAiOutput(problemIntelligenceDraftSchema, draft);
    expect(parsed.odooRequirements).toBe('unknown');
    expect(parsed.integrations).toBe('unknown');
  });

  it('strips extra execution fields from AI output', () => {
    const parsed = parseAiOutput(problemIntelligenceDraftSchema, {
      ...buildProblemIntelligenceDraft(),
      executeSql: 'DROP TABLE users',
      writeFile: 'rm -rf /',
      callOdoo: 'unrestricted',
    });
    expect(parsed).not.toHaveProperty('executeSql');
    expect(parsed).not.toHaveProperty('writeFile');
    expect(parsed).not.toHaveProperty('callOdoo');
  });
});

describe('problemIntelligenceAnalyzeBodySchema', () => {
  it('rejects an empty statement', () => {
    expect(() => problemIntelligenceAnalyzeBodySchema.parse({ statement: '   ' })).toThrow();
  });
});
