import { createHmac, timingSafeEqual } from 'node:crypto';

import { AuthenticationError, ValidationError } from '../../errors';
import { assertStorageKey } from './storage.keys';
import type { SignedDownload } from './storage.types';

export const STORAGE_DOWNLOAD_MAX_SECONDS = 86_400;
export const STORAGE_DOWNLOAD_DEFAULT_SECONDS = 300;
export const DEV_STORAGE_SIGNING_SECRET = 'dev-storage-signing-secret-not-jwt';

export interface StorageSigning {
  appUrl: string;
  secret: string;
}

export interface SignedDownloadClaims {
  key: string;
  subject?: string;
}

export function createSignedDownload(
  key: string,
  expiresInSeconds: number,
  signing: StorageSigning,
  options: { subject?: string } = {},
): SignedDownload {
  const safeKey = assertStorageKey(key);
  const ttl = clampExpiry(expiresInSeconds);
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const subject = normalizeSubject(options.subject);
  const signature = signStorageDownload(signing.secret, safeKey, expires, subject);
  const url = new URL('/api/v1/storage/download', signing.appUrl);
  url.searchParams.set('key', safeKey);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('sig', signature);
  if (subject) {
    url.searchParams.set('uid', subject);
  }

  return {
    key: safeKey,
    url: url.toString(),
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}

export function verifySignedDownload(input: {
  key: string;
  expires: string;
  signature: string;
  secret: string;
  subject?: string;
}): SignedDownloadClaims {
  const safeKey = assertStorageKey(input.key);
  const expires = Number(input.expires);
  if (!Number.isInteger(expires) || expires * 1000 < Date.now()) {
    throw new AuthenticationError('Download link has expired');
  }

  const subject = normalizeSubject(input.subject);
  const expected = signStorageDownload(input.secret, safeKey, expires, subject);
  const actual = input.signature.trim().toLowerCase();
  if (!safeEqualHex(expected, actual)) {
    throw new AuthenticationError('Download link is invalid');
  }

  return subject ? { key: safeKey, subject } : { key: safeKey };
}

export function contentTypeFromKey(key: string): string {
  const extension = key.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'txt':
      return 'text/plain; charset=utf-8';
    case 'csv':
      return 'text/csv; charset=utf-8';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

function signStorageDownload(secret: string, key: string, expires: number, subject?: string): string {
  return createHmac('sha256', secret).update(`v2\n${key}\n${expires}\n${subject ?? ''}`).digest('hex');
}

function normalizeSubject(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function clampExpiry(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new ValidationError('Invalid download expiry', [
      { path: 'expiresInSeconds', message: 'Expiry must be a positive number of seconds', code: 'custom' },
    ]);
  }

  return Math.min(Math.floor(seconds), STORAGE_DOWNLOAD_MAX_SECONDS);
}

function safeEqualHex(expected: string, actual: string): boolean {
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(actual, 'hex');
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
