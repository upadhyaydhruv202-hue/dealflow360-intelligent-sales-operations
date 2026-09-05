import path from 'node:path';

import { STORAGE } from '../../constants';
import { ValidationError, type ValidationIssue } from '../../errors';
import {
  STORAGE_MIME_TYPES,
  STORAGE_PURPOSE_EXTENSIONS,
  type StorageExtension,
  type StoragePurpose,
  type UploadedFileInput,
  type ValidatedUpload,
} from './storage.types';

const MAGIC = {
  pdf: Buffer.from('%PDF'),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpeg: Buffer.from([0xff, 0xd8, 0xff]),
  gif: Buffer.from('GIF8', 'ascii'),
  riff: Buffer.from('RIFF', 'ascii'),
  webp: Buffer.from('WEBP', 'ascii'),
} as const;

export function validateUploadedFile(
  input: UploadedFileInput,
  options: { maxBytes?: number; purpose?: StoragePurpose } = {},
): ValidatedUpload {
  const maxBytes = options.maxBytes ?? STORAGE.MAX_BYTES;
  const purpose = options.purpose ?? 'attachment';
  const allowed = STORAGE_PURPOSE_EXTENSIONS[purpose];
  const issues: ValidationIssue[] = [];

  if (!input.buffer || input.buffer.length === 0 || input.size === 0) {
    throw new ValidationError('Invalid uploaded file', [
      { path: 'file', message: 'File is empty', code: 'too_small' },
    ]);
  }

  if (input.buffer.length !== input.size) {
    throw new ValidationError('Invalid uploaded file', [
      { path: 'file.size', message: 'File size does not match the uploaded content', code: 'custom' },
    ]);
  }

  if (input.buffer.length > maxBytes || input.size > maxBytes) {
    throw new ValidationError('Uploaded file is too large', [
      { path: 'file.size', message: 'File exceeds the maximum allowed size', code: 'too_big' },
    ]);
  }

  const originalName = assertSafeFilename(input.originalname);
  const extension = extensionOf(originalName);
  if (!extension) {
    issues.push({
      path: 'file.originalname',
      message: `File extension is not allowed for ${purpose} uploads`,
      code: 'custom',
    });
  } else if (!allowed.includes(extension)) {
    issues.push({
      path: 'file.originalname',
      message: `File extension is not allowed for ${purpose} uploads`,
      code: 'custom',
    });
  }

  if (extension && !contentMatchesExtension(input.buffer, extension)) {
    issues.push({
      path: 'file',
      message: 'File content does not match the file extension',
      code: 'custom',
    });
  }

  if (issues.length > 0) {
    throw new ValidationError('Invalid uploaded file', issues);
  }

  const safeExtension = extension as StorageExtension;

  return {
    originalName,
    storedName: sanitizeStoredFilename(originalName, safeExtension),
    extension: safeExtension,
    mimeType: STORAGE_MIME_TYPES[safeExtension],
    size: input.buffer.length,
    buffer: input.buffer,
  };
}

export function assertSafeFilename(originalname: string, maxLength = STORAGE.MAX_FILENAME_LENGTH): string {
  const trimmed = originalname.trim();
  if (!trimmed) {
    throw new ValidationError('Invalid uploaded file', [
      { path: 'file.originalname', message: 'Filename is required', code: 'too_small' },
    ]);
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError('Invalid uploaded file', [
      { path: 'file.originalname', message: 'Filename is too long', code: 'too_big' },
    ]);
  }

  if (
    hasControlChars(trimmed) ||
    /[\\/]/.test(trimmed) ||
    trimmed.includes('..') ||
    trimmed === '.' ||
    trimmed === '..'
  ) {
    throw new ValidationError('Invalid uploaded file', [
      { path: 'file.originalname', message: 'Filename is not allowed', code: 'custom' },
    ]);
  }

  const base = path.basename(trimmed);
  if (base !== trimmed) {
    throw new ValidationError('Invalid uploaded file', [
      { path: 'file.originalname', message: 'Filename must not include a path', code: 'custom' },
    ]);
  }

  return trimmed;
}

function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) {
      return true;
    }
  }

  return false;
}

export function sanitizeStoredFilename(original: string, extension: string): string {
  const stem = original.slice(0, Math.max(0, original.lastIndexOf('.'))) || original;
  const cleaned = stem.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '') || 'file';
  return `${cleaned.slice(0, 180)}.${extension}`;
}

function extensionOf(filename: string): StorageExtension | undefined {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  const extension = match?.[1];
  if (
    extension === 'pdf' ||
    extension === 'png' ||
    extension === 'jpg' ||
    extension === 'jpeg' ||
    extension === 'gif' ||
    extension === 'webp' ||
    extension === 'txt' ||
    extension === 'csv' ||
    extension === 'json'
  ) {
    return extension;
  }

  return undefined;
}

function contentMatchesExtension(buffer: Buffer, extension: StorageExtension): boolean {
  const sniffed = sniffBinaryType(buffer);

  if (extension === 'pdf') {
    return sniffed === 'pdf';
  }
  if (extension === 'png') {
    return sniffed === 'png';
  }
  if (extension === 'jpg' || extension === 'jpeg') {
    return sniffed === 'jpeg';
  }
  if (extension === 'gif') {
    return sniffed === 'gif';
  }
  if (extension === 'webp') {
    return sniffed === 'webp';
  }

  if (sniffed) {
    return false;
  }

  if (extension === 'json') {
    return isJsonPayload(buffer);
  }

  return isMostlyText(buffer);
}

function sniffBinaryType(buffer: Buffer): 'pdf' | 'png' | 'jpeg' | 'gif' | 'webp' | undefined {
  if (buffer.subarray(0, 4).equals(MAGIC.pdf)) {
    return 'pdf';
  }
  if (buffer.subarray(0, 8).equals(MAGIC.png)) {
    return 'png';
  }
  if (buffer.subarray(0, 3).equals(MAGIC.jpeg)) {
    return 'jpeg';
  }
  if (buffer.subarray(0, 4).equals(MAGIC.gif)) {
    return 'gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(MAGIC.riff) &&
    buffer.subarray(8, 12).equals(MAGIC.webp)
  ) {
    return 'webp';
  }

  return undefined;
}

function isJsonPayload(buffer: Buffer): boolean {
  if (!isMostlyText(buffer)) {
    return false;
  }

  const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  return text.startsWith('{') || text.startsWith('[');
}

function isMostlyText(buffer: Buffer): boolean {
  if (buffer.includes(0)) {
    return false;
  }

  let suspicious = 0;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  for (const byte of sample) {
    if (byte < 9 || (byte > 13 && byte < 32) || byte === 127) {
      suspicious += 1;
    }
  }

  return suspicious / sample.length < 0.1;
}
