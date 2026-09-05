import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

import { DOCUMENT } from '../../constants';
import { ValidationError, type ValidationIssue } from '../../errors';
import { parseFileMetadata } from '../../schemas/parse';
import { createFileMetadataSchema } from '../../schemas/common';
import { assertSafeFilename } from '../storage/storage.validate';
import {
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  type DocumentExtension,
  type UploadedDocumentInput,
  type ValidatedDocumentFile,
} from './document.types';

const MAGIC = {
  pdf: Buffer.from('%PDF'),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpeg: Buffer.from([0xff, 0xd8, 0xff]),
} as const;

const EXTENSION_MIME: Record<DocumentExtension, string> = {
  pdf: DOCUMENT_MIME_TYPES.pdf,
  png: DOCUMENT_MIME_TYPES.png,
  jpg: DOCUMENT_MIME_TYPES.jpg,
  jpeg: DOCUMENT_MIME_TYPES.jpeg,
  txt: DOCUMENT_MIME_TYPES.txt,
};

export function validateDocumentFile(
  input: UploadedDocumentInput,
  options: { maxBytes?: number } = {},
): ValidatedDocumentFile {
  const maxBytes = options.maxBytes ?? DOCUMENT.MAX_BYTES;
  const issues: ValidationIssue[] = [];

  parseFileMetadata(
    createFileMetadataSchema({
      maxBytes,
      allowedMimeTypes: DOCUMENT_ALLOWED_MIME_TYPES,
    }),
    {
      fieldname: input.fieldname,
      originalname: input.originalname,
      mimetype: input.mimetype,
      size: input.size,
    },
  );

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

  if (input.buffer.length > maxBytes) {
    throw new ValidationError('Uploaded file is too large', [
      { path: 'file.size', message: 'File exceeds the maximum allowed size', code: 'too_big' },
    ]);
  }

  const originalFilename = assertSafeFilename(input.originalname);
  const extension = extensionOf(originalFilename);
  if (!extension) {
    issues.push({
      path: 'file.originalname',
      message: 'File extension is not allowed. Use pdf, png, jpg, jpeg, or txt',
      code: 'custom',
    });
  }

  if (extension && EXTENSION_MIME[extension] !== input.mimetype) {
    issues.push({
      path: 'file.mimetype',
      message: 'File extension does not match the declared MIME type',
      code: 'custom',
    });
  }

  if (extension && !magicMatches(input.buffer, extension)) {
    issues.push({
      path: 'file',
      message: 'File content does not match the declared type',
      code: 'custom',
    });
  }

  if (issues.length > 0) {
    throw new ValidationError('Invalid uploaded file', issues);
  }

  const storedFilename = sanitizeStoredFilename(originalFilename, extension as DocumentExtension);

  return {
    originalFilename,
    storedFilename,
    extension: extension as DocumentExtension,
    mimeType: input.mimetype,
    size: input.buffer.length,
    buffer: input.buffer,
    checksumSha256: createHash('sha256').update(input.buffer).digest('hex'),
  };
}

export { assertSafeFilename } from '../storage/storage.validate';

export function extractDocumentText(
  file: Pick<ValidatedDocumentFile, 'buffer' | 'extension' | 'mimeType' | 'originalFilename'>,
  maxChars: number = DOCUMENT.MAX_TEXT_CHARS,
): { text: string; truncated: boolean; multimodal: boolean } {
  if (file.extension === 'txt') {
    const text = decodeUtf8(file.buffer);
    if (text.length <= maxChars) {
      return { text, truncated: false, multimodal: false };
    }

    return { text: text.slice(0, maxChars), truncated: true, multimodal: false };
  }

  const extracted = file.extension === 'pdf' ? extractPdfText(file.buffer) : '';
  const preamble = [
    `Document filename: ${file.originalFilename}`,
    `MIME type: ${file.mimeType}`,
    extracted ? 'Extracted text follows. Use null for values that are not present.' : 'The original file is attached. Use null for values that are not visible.',
  ].join('\n');
  const combined = extracted ? `${preamble}\n\n${extracted}` : preamble;

  if (combined.length <= maxChars) {
    return { text: combined, truncated: false, multimodal: extracted.length === 0 };
  }

  return { text: combined.slice(0, maxChars), truncated: true, multimodal: extracted.length === 0 };
}

function sanitizeStoredFilename(original: string, extension: DocumentExtension): string {
  const stem = original.slice(0, Math.max(0, original.lastIndexOf('.'))) || original;
  const cleaned = stem.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '') || 'document';
  return `${cleaned.slice(0, 180)}.${extension}`;
}

function extensionOf(filename: string): DocumentExtension | undefined {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  const extension = match?.[1];
  if (extension === 'pdf' || extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'txt') {
    return extension;
  }

  return undefined;
}

function magicMatches(buffer: Buffer, extension: DocumentExtension): boolean {
  if (extension === 'pdf') {
    return buffer.subarray(0, 4).equals(MAGIC.pdf);
  }

  if (extension === 'png') {
    return buffer.subarray(0, 8).equals(MAGIC.png);
  }

  if (extension === 'jpg' || extension === 'jpeg') {
    return buffer.subarray(0, 3).equals(MAGIC.jpeg);
  }

  if (looksLikePdf(buffer) || looksLikePng(buffer) || looksLikeJpeg(buffer)) {
    return false;
  }

  return isMostlyText(buffer);
}

function looksLikePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).equals(MAGIC.pdf);
}

function looksLikePng(buffer: Buffer): boolean {
  return buffer.subarray(0, 8).equals(MAGIC.png);
}

function looksLikeJpeg(buffer: Buffer): boolean {
  return buffer.subarray(0, 3).equals(MAGIC.jpeg);
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

function decodeUtf8(buffer: Buffer): string {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
  if (replacementCount > 0 && replacementCount / Math.max(text.length, 1) > 0.05) {
    throw new ValidationError('Invalid uploaded file', [
      { path: 'file', message: 'Text file is not valid UTF-8', code: 'custom' },
    ]);
  }

  return text.trim();
}

function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  if (/\/Encrypt\b/.test(raw)) {
    return '';
  }

  const chunks: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null = streamPattern.exec(raw);

  while (match) {
    const payload = Buffer.from(match[1] ?? '', 'latin1');
    const decoded = decodePdfStream(payload);
    chunks.push(collectPdfStrings(decoded));
    match = streamPattern.exec(raw);
  }

  if (chunks.every((chunk) => chunk.length === 0)) {
    chunks.push(collectPdfStrings(raw));
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

const MAX_PDF_DECODE_BYTES = 1_000_000;

function decodePdfStream(payload: Buffer): string {
  try {
    return inflateSync(payload, { maxOutputLength: MAX_PDF_DECODE_BYTES }).toString('latin1');
  } catch {
    try {
      return inflateSync(payload.subarray(2), { maxOutputLength: MAX_PDF_DECODE_BYTES }).toString('latin1');
    } catch {
      return payload.subarray(0, MAX_PDF_DECODE_BYTES).toString('latin1');
    }
  }
}

function collectPdfStrings(source: string): string {
  const pieces: string[] = [];
  const pattern = /\((?:\\.|[^\\)])*\)/g;
  const matches = source.match(pattern) ?? [];

  for (const token of matches) {
    const inner = token.slice(1, -1).replace(/\\([nrt\\()])/g, (_, char: string) => {
      if (char === 'n') return '\n';
      if (char === 'r') return '\r';
      if (char === 't') return '\t';
      return char;
    });
    if (/[A-Za-z0-9]/.test(inner)) {
      pieces.push(inner);
    }
  }

  return pieces.join(' ');
}
