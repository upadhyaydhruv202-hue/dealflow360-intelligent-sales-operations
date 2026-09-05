import { describe, expect, it } from 'vitest';

import { PAGINATION } from '../constants';
import {
  createFileMetadataSchema,
  dateSchema,
  e164PhoneSchema,
  emailSchema,
  enumSchema,
  idSchema,
  isoDateStringSchema,
  paginationQuerySchema,
  requestIdSchema,
  sortQuerySchema,
  uploadedFileMetadataSchema,
  urlSchema,
} from './common';

describe('common schemas', () => {
  it('accepts IDs, emails, URLs, dates, and enums', () => {
    expect(idSchema.parse('00000000-0000-4000-8000-000000000001')).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(emailSchema.parse('  User@Example.COM ')).toBe('user@example.com');
    expect(e164PhoneSchema.parse('+15551234567')).toBe('+15551234567');
    expect(urlSchema.parse('https://example.com/path')).toBe('https://example.com/path');
    expect(isoDateStringSchema.parse('2026-08-28T12:00:00.000Z')).toBe('2026-08-28T12:00:00.000Z');
    expect(dateSchema.parse('2026-08-28T12:00:00.000Z')).toBeInstanceOf(Date);
    expect(enumSchema(['draft', 'published'] as const).parse('draft')).toBe('draft');
    expect(requestIdSchema.parse('fixed-id')).toBe('fixed-id');
  });

  it('rejects invalid reusable values', () => {
    expect(() => idSchema.parse('not-a-uuid')).toThrow();
    expect(() => emailSchema.parse('not-an-email')).toThrow();
    expect(() => e164PhoneSchema.parse('555-1234')).toThrow();
    expect(() => urlSchema.parse('not-a-url')).toThrow();
    expect(() => isoDateStringSchema.parse('tomorrow')).toThrow();
    expect(() => enumSchema(['a', 'b'] as const).parse('c')).toThrow();
  });

  it('parses pagination and sorting query strings', () => {
    expect(paginationQuerySchema.parse({})).toEqual({
      page: PAGINATION.DEFAULT_PAGE,
      pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
    });
    expect(paginationQuerySchema.parse({ page: '2', pageSize: ['10'] })).toEqual({
      page: 2,
      pageSize: 10,
    });
    expect(sortQuerySchema.parse({ sortBy: ' email ', sortOrder: 'ASC' })).toEqual({
      sortBy: 'email',
      sortOrder: 'asc',
    });
    expect(() => paginationQuerySchema.parse({ pageSize: PAGINATION.MAX_PAGE_SIZE + 1 })).toThrow();
    expect(() => sortQuerySchema.parse({ sortOrder: 'sideways' })).toThrow();
  });

  it('strips filesystem paths from uploaded file metadata', () => {
    const parsed = uploadedFileMetadataSchema.parse({
      fieldname: 'file',
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: 128,
      path: '/etc/passwd',
      destination: 'D:\\uploads',
    });

    expect(parsed).toEqual({
      fieldname: 'file',
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: 128,
    });
    expect(parsed).not.toHaveProperty('path');
  });

  it('enforces upload size and MIME allowlists', () => {
    const schema = createFileMetadataSchema({
      maxBytes: 100,
      allowedMimeTypes: ['image/png'],
    });

    expect(() =>
      schema.parse({
        originalname: 'photo.png',
        mimetype: 'image/png',
        size: 101,
      }),
    ).toThrow();
    expect(() =>
      schema.parse({
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 10,
      }),
    ).toThrow();
  });
});
