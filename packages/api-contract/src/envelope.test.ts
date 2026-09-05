import { describe, expect, it } from 'vitest';

import {
  createErrorEnvelope,
  createSuccessEnvelope,
  errorResponseSchema,
  isErrorResponse,
  isSuccessResponse,
  parseApiResponse,
  unknownSuccessResponseSchema,
} from './envelope';
import { ERROR_CODES } from './errors';

describe('API envelopes', () => {
  it('accepts the documented success shape including empty meta', () => {
    const envelope = createSuccessEnvelope({ id: '1' });
    expect(envelope).toEqual({ success: true, data: { id: '1' }, meta: {} });
    expect(unknownSuccessResponseSchema.parse(envelope)).toEqual(envelope);
    expect(isSuccessResponse(envelope)).toBe(true);
    expect(isErrorResponse(envelope)).toBe(false);
  });

  it('accepts pagination fields inside meta without requiring them', () => {
    const envelope = createSuccessEnvelope({ items: [] }, {
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(unknownSuccessResponseSchema.parse(envelope).meta).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('accepts the documented error shape with object or array details', () => {
    const objectDetails = createErrorEnvelope({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Missing',
      details: { resource: 'job' },
      requestId: 'req-1',
    });
    const arrayDetails = createErrorEnvelope({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Invalid input',
      details: [{ path: 'email', message: 'Required', code: 'required' }],
      requestId: 'req-2',
    });

    expect(errorResponseSchema.parse(objectDetails)).toEqual(objectDetails);
    expect(errorResponseSchema.parse(arrayDetails)).toEqual(arrayDetails);
    expect(isErrorResponse(objectDetails)).toBe(true);
    expect(isSuccessResponse(objectDetails)).toBe(false);
  });

  it('rejects envelopes that drop required fields', () => {
    expect(unknownSuccessResponseSchema.safeParse({ success: true, data: {} }).success).toBe(false);
    expect(
      errorResponseSchema.safeParse({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Missing' },
      }).success,
    ).toBe(false);
    expect(() => parseApiResponse({ ok: true })).toThrow();
  });
});
