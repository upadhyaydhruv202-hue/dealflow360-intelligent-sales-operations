import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ExternalServiceError, ValidationError } from '../errors';
import {
  parseAiOutput,
  parseBody,
  parseConfig,
  parseFileMetadata,
  parseHeaders,
  parseParams,
  parseProviderResponse,
  parseQuery,
} from './parse';
import { createFileMetadataSchema, idParamsSchema, paginationQuerySchema } from './common';

describe('parse helpers', () => {
  it('validates request bodies and prefixes issue paths', () => {
    expect(() => parseBody(z.object({ email: z.string().email() }), { email: 'nope' })).toThrow(
      ValidationError,
    );

    try {
      parseBody(z.object({ email: z.string().email() }), { email: 'nope' });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).message).toBe('Invalid request');
      expect((error as ValidationError).details).toEqual([
        expect.objectContaining({
          path: 'body.email',
          message: expect.any(String),
          code: expect.any(String),
        }),
      ]);
    }
  });

  it('validates path, query, and headers', () => {
    expect(parseParams(idParamsSchema, { id: '00000000-0000-4000-8000-000000000001' }).id).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(() => parseParams(idParamsSchema, { id: 'not-a-uuid' })).toThrow(ValidationError);

    expect(parseQuery(paginationQuerySchema, { page: '2', pageSize: '5' })).toEqual({
      page: 2,
      pageSize: 5,
    });
    expect(() => parseQuery(paginationQuerySchema, { page: '0' })).toThrow(ValidationError);

    expect(() =>
      parseHeaders(z.object({ 'x-api-version': z.string().regex(/^v\d+$/) }), {
        'x-api-version': 'nope',
      }),
    ).toThrow(ValidationError);
  });

  it('validates uploaded file metadata without leaking filesystem paths', () => {
    const parsed = parseFileMetadata(createFileMetadataSchema({ allowedMimeTypes: ['image/png'] }), {
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: 12,
      path: 'C:\\secrets\\photo.png',
    });

    expect(parsed.originalname).toBe('photo.png');
    expect(parsed).not.toHaveProperty('path');
    expect(() =>
      parseFileMetadata(createFileMetadataSchema({ allowedMimeTypes: ['image/png'] }), {
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 12,
      }),
    ).toThrow(ValidationError);
  });

  it('rejects malformed AI output', () => {
    const schema = z.object({
      action: z.enum(['summarize', 'classify']),
      confidence: z.number().min(0).max(1),
    });

    expect(parseAiOutput(schema, { action: 'summarize', confidence: 0.9 })).toEqual({
      action: 'summarize',
      confidence: 0.9,
    });

    try {
      parseAiOutput(schema, { action: 'DROP TABLE users', confidence: 9 });
      throw new Error('expected ValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).message).toBe('AI output failed schema validation');
      expect((error as ValidationError).details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'ai.action' }),
          expect.objectContaining({ path: 'ai.confidence' }),
        ]),
      );
    }
  });

  it('maps invalid provider responses to ExternalServiceError without raw payloads', () => {
    const schema = z.object({ id: z.string(), status: z.enum(['ok']) });

    expect(parseProviderResponse(schema, { id: '1', status: 'ok' }, 'odoo')).toEqual({
      id: '1',
      status: 'ok',
    });

    try {
      parseProviderResponse(schema, { error: 'api-key=super-secret', status: 'fail' }, 'odoo');
      throw new Error('expected ExternalServiceError');
    } catch (error) {
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).details).toMatchObject({ provider: 'odoo' });
      expect(JSON.stringify((error as ExternalServiceError).details)).not.toContain('super-secret');
    }
  });

  it('formats configuration failures without becoming an HTTP error', () => {
    expect(() => parseConfig(z.object({ PORT: z.coerce.number() }), { PORT: 'nope' })).toThrow(
      /Invalid configuration/,
    );
    expect(() => parseConfig(z.object({ PORT: z.coerce.number() }), { PORT: 'nope' })).not.toThrow(
      ValidationError,
    );
  });
});
