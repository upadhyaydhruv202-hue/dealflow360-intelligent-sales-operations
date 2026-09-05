import { describe, expect, it } from 'vitest';

import { AuthenticationError } from '../../errors';
import { createSignedDownload, verifySignedDownload } from './storage.sign';

describe('signed downloads', () => {
  const signing = { appUrl: 'http://localhost:5000', secret: 'unit-test-secret' };

  it('creates a verifiable local download URL', () => {
    const signed = createSignedDownload('documents/a.txt', 300, signing);
    expect(signed.url).toContain('/api/v1/storage/download');
    expect(signed.url).not.toContain('uid=');
    const url = new URL(signed.url);
    expect(
      verifySignedDownload({
        key: url.searchParams.get('key') ?? '',
        expires: url.searchParams.get('expires') ?? '',
        signature: url.searchParams.get('sig') ?? '',
        secret: signing.secret,
      }),
    ).toEqual({ key: 'documents/a.txt' });
  });

  it('binds an optional subject into the HMAC and query string', () => {
    const signed = createSignedDownload('documents/a.txt', 300, signing, { subject: 'user-1' });
    const url = new URL(signed.url);
    expect(url.searchParams.get('uid')).toBe('user-1');
    expect(
      verifySignedDownload({
        key: url.searchParams.get('key') ?? '',
        expires: url.searchParams.get('expires') ?? '',
        signature: url.searchParams.get('sig') ?? '',
        secret: signing.secret,
        subject: 'user-1',
      }),
    ).toEqual({ key: 'documents/a.txt', subject: 'user-1' });

    expect(() =>
      verifySignedDownload({
        key: url.searchParams.get('key') ?? '',
        expires: url.searchParams.get('expires') ?? '',
        signature: url.searchParams.get('sig') ?? '',
        secret: signing.secret,
      }),
    ).toThrow(AuthenticationError);

    expect(() =>
      verifySignedDownload({
        key: url.searchParams.get('key') ?? '',
        expires: url.searchParams.get('expires') ?? '',
        signature: url.searchParams.get('sig') ?? '',
        secret: signing.secret,
        subject: 'user-2',
      }),
    ).toThrow(AuthenticationError);
  });

  it('rejects a tampered signature', () => {
    const signed = createSignedDownload('documents/a.txt', 300, signing);
    const url = new URL(signed.url);
    expect(() =>
      verifySignedDownload({
        key: url.searchParams.get('key') ?? '',
        expires: url.searchParams.get('expires') ?? '',
        signature: 'a'.repeat(64),
        secret: signing.secret,
      }),
    ).toThrow(AuthenticationError);
  });
});
