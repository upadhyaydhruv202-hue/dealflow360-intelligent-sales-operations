import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../errors';
import { validateUploadedFile } from './storage.validate';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

function upload(overrides: Partial<{ originalname: string; mimetype: string; buffer: Buffer }> = {}) {
  const buffer = overrides.buffer ?? Buffer.from('hello world', 'utf8');
  return {
    originalname: overrides.originalname ?? 'notes.txt',
    mimetype: overrides.mimetype ?? 'application/octet-stream',
    size: buffer.length,
    buffer,
    fieldname: 'file',
  };
}

describe('validateUploadedFile', () => {
  it('accepts a text file and ignores a misleading client MIME type', () => {
    const file = validateUploadedFile(upload({ mimetype: 'image/png' }));
    expect(file.mimeType).toBe('text/plain');
    expect(file.storedName).toBe('notes.txt');
  });

  it('detects PNG from magic bytes even when the client reports JPEG', () => {
    const file = validateUploadedFile(
      upload({ originalname: 'photo.png', mimetype: 'image/jpeg', buffer: PNG }),
    );
    expect(file.mimeType).toBe('image/png');
  });

  it('rejects path traversal, unsupported types, and disguised binaries', () => {
    expect(() => validateUploadedFile(upload({ originalname: 'payload.exe' }))).toThrow(ValidationError);
    expect(() => validateUploadedFile(upload({ originalname: '../secret.txt' }))).toThrow(ValidationError);
    expect(() => validateUploadedFile(upload({ originalname: '..\\secret.txt' }))).toThrow(ValidationError);
    expect(() => validateUploadedFile(upload({ originalname: 'notes.txt', buffer: PNG }))).toThrow(ValidationError);
  });

  it('rejects oversized and empty files', () => {
    const huge = Buffer.alloc(64, 65);
    expect(() =>
      validateUploadedFile(
        { originalname: 'big.txt', mimetype: 'text/plain', size: huge.length, buffer: huge },
        { maxBytes: 16 },
      ),
    ).toThrow(ValidationError);

    expect(() =>
      validateUploadedFile({
        originalname: 'empty.txt',
        mimetype: 'text/plain',
        size: 0,
        buffer: Buffer.alloc(0),
      }),
    ).toThrow(ValidationError);
  });

  it('rejects a JPEG extension when the content is a PNG', () => {
    expect(() =>
      validateUploadedFile(upload({ originalname: 'photo.jpg', mimetype: 'image/jpeg', buffer: PNG })),
    ).toThrow(ValidationError);
  });

  it('rejects avatars that are not images', () => {
    expect(() => validateUploadedFile(upload({ originalname: 'bio.txt' }), { purpose: 'avatar' })).toThrow(
      ValidationError,
    );
    expect(
      validateUploadedFile(upload({ originalname: 'me.png', buffer: PNG }), { purpose: 'avatar' }).extension,
    ).toBe('png');
  });

  it('accepts JPEG magic bytes', () => {
    expect(
      validateUploadedFile(upload({ originalname: 'scan.jpg', buffer: JPEG })).mimeType,
    ).toBe('image/jpeg');
  });
});
