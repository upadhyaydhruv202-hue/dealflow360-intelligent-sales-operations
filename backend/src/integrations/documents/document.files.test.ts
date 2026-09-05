import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../errors';
import { extractDocumentText, validateDocumentFile } from './document.files';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

const PDF = Buffer.from(
  '%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>endobj\n4 0 obj<< /Length 48 >>stream\nBT /F1 12 Tf 10 100 Td (Invoice 42 from Acme) Tj ET\nendstream\nendobj\ntrailer\n%%EOF\n',
  'utf8',
);

function upload(overrides: Partial<{ originalname: string; mimetype: string; buffer: Buffer }> = {}) {
  const buffer = overrides.buffer ?? Buffer.from('Invoice 42 from Acme', 'utf8');
  return {
    originalname: overrides.originalname ?? 'invoice.txt',
    mimetype: overrides.mimetype ?? 'text/plain',
    size: buffer.length,
    buffer,
    fieldname: 'file',
  };
}

describe('document file validation', () => {
  it('accepts a valid text upload and extracts content', () => {
    const file = validateDocumentFile(upload());
    expect(file.extension).toBe('txt');
    expect(file.storedFilename).toBe('invoice.txt');
    expect(extractDocumentText(file).text).toContain('Invoice 42');
  });

  it('accepts PNG, JPEG, and uncompressed PDF magic bytes', () => {
    expect(validateDocumentFile(upload({ originalname: 'scan.png', mimetype: 'image/png', buffer: PNG })).mimeType).toBe(
      'image/png',
    );
    expect(
      validateDocumentFile(upload({ originalname: 'scan.jpg', mimetype: 'image/jpeg', buffer: JPEG })).extension,
    ).toBe('jpg');
    const pdf = validateDocumentFile(upload({ originalname: 'invoice.pdf', mimetype: 'application/pdf', buffer: PDF }));
    expect(extractDocumentText(pdf).text).toMatch(/Invoice 42/);
  });

  it('rejects unsupported types, path traversal, and disguised binaries', () => {
    expect(() =>
      validateDocumentFile(upload({ originalname: 'payload.exe', mimetype: 'application/octet-stream' })),
    ).toThrow(ValidationError);

    expect(() =>
      validateDocumentFile(upload({ originalname: '../secret.txt', mimetype: 'text/plain' })),
    ).toThrow(ValidationError);

    expect(() =>
      validateDocumentFile(upload({ originalname: '..\\secret.txt', mimetype: 'text/plain' })),
    ).toThrow(ValidationError);

    expect(() =>
      validateDocumentFile(upload({ originalname: 'notes.txt', mimetype: 'text/plain', buffer: PNG })),
    ).toThrow(ValidationError);
  });

  it('rejects oversized files and empty files', () => {
    const huge = Buffer.alloc(64, 65);
    expect(() =>
      validateDocumentFile(
        {
          originalname: 'big.txt',
          mimetype: 'text/plain',
          size: huge.length,
          buffer: huge,
        },
        { maxBytes: 16 },
      ),
    ).toThrow(ValidationError);

    expect(() =>
      validateDocumentFile({
        originalname: 'empty.txt',
        mimetype: 'text/plain',
        size: 0,
        buffer: Buffer.alloc(0),
      }),
    ).toThrow(ValidationError);
  });

  it('rejects MIME and extension mismatches', () => {
    expect(() =>
      validateDocumentFile(upload({ originalname: 'photo.png', mimetype: 'image/jpeg', buffer: PNG })),
    ).toThrow(ValidationError);
  });

  it('caps inflated PDF streams so a compression bomb does not exhaust memory', () => {
    const compressed = deflateSync(Buffer.alloc(2_000_000, 0x41));
    const pdf = Buffer.from(`%PDF-1.1\nstream\n${compressed.toString('latin1')}endstream\n%%EOF`, 'latin1');
    const file = validateDocumentFile(
      upload({ originalname: 'bomb.pdf', mimetype: 'application/pdf', buffer: pdf }),
    );
    const started = Date.now();
    const extracted = extractDocumentText(file);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(extracted.text.length).toBeLessThan(1_500_000);
  });
});
