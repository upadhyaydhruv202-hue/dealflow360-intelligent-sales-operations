import { describe, expect, it } from 'vitest';

import { ExternalServiceError, ValidationError } from '../errors';
import { loadConfig } from '../config';
import {
  assertHttpUrl,
  assertSafeExternalUrl,
  createPinnedLookup,
  fetchExternal,
  isBlockedHost,
  secureCookieOptions,
} from './index';

describe('assertSafeExternalUrl', () => {
  it('allows public https URLs', () => {
    expect(assertSafeExternalUrl('https://hooks.example.com/notify').hostname).toBe('hooks.example.com');
  });

  it('rejects loopback, private, metadata, and non-http schemes', () => {
    const blocked = [
      'http://127.0.0.1/',
      'http://localhost/admin',
      'http://10.0.0.5/secret',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'file:///etc/passwd',
      'gopher://example.com/',
      'https://user:pass@example.com/',
      'https://example.com:8080/hook',
    ];

    for (const url of blocked) {
      expect(() => assertSafeExternalUrl(url), url).toThrow(ValidationError);
    }
  });
});

describe('assertHttpUrl', () => {
  it('allows operator-configured private HTTP URLs', () => {
    expect(assertHttpUrl('http://10.0.0.8:8080/sms').href).toContain('10.0.0.8');
  });

  it('rejects non-http schemes', () => {
    expect(() => assertHttpUrl('file:///tmp/x')).toThrow(ValidationError);
  });
});

describe('isBlockedHost', () => {
  it('blocks decimal IPs and metadata hostnames', () => {
    expect(isBlockedHost('2130706433')).toBe(true);
    expect(isBlockedHost('metadata.google.internal')).toBe(true);
  });
});

describe('fetchExternal', () => {
  it('rejects hostnames that resolve to private addresses', async () => {
    await expect(
      fetchExternal('https://hooks.example.com/notify', {
        timeoutMs: 1_000,
        lookup: async () => ['10.0.0.8'],
        fetchImpl: async () => {
          throw new Error('must not fetch');
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects hostnames that resolve to loopback', async () => {
    await expect(
      fetchExternal('https://hooks.example.com/notify', {
        timeoutMs: 1_000,
        lookup: async () => ['127.0.0.1'],
        fetchImpl: async () => {
          throw new Error('must not fetch');
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('does not leak DNS failures', async () => {
    await expect(
      fetchExternal('https://missing.example.com/notify', {
        timeoutMs: 1_000,
        lookup: async () => {
          throw new Error('ENOTFOUND');
        },
        fetchImpl: async () => {
          throw new Error('must not fetch');
        },
      }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('fetches when DNS resolves to a public address', async () => {
    const response = await fetchExternal('https://hooks.example.com/notify', {
      timeoutMs: 1_000,
      lookup: async () => ['203.0.113.10'],
      fetchImpl: async () => new Response('ok', { status: 200 }),
    });
    expect(response.status).toBe(200);
  });

  it('pins connect DNS to the already-validated address', async () => {
    let lookups = 0;
    let captured: RequestInit | undefined;
    const response = await fetchExternal('https://hooks.example.com/notify', {
      timeoutMs: 1_000,
      lookup: async () => {
        lookups += 1;
        return lookups === 1 ? ['203.0.113.10'] : ['127.0.0.1'];
      },
      fetchImpl: async (_url, init) => {
        captured = init;
        return new Response('ok', { status: 200 });
      },
    });
    expect(response.status).toBe(200);
    expect(lookups).toBe(1);
    expect(captured).toEqual(expect.objectContaining({ pinnedAddress: '203.0.113.10' }));
  });
});

describe('createPinnedLookup', () => {
  it('returns the validated address even if the hostname later rebinds', async () => {
    const lookup = createPinnedLookup('203.0.113.10');
    await new Promise<void>((resolve, reject) => {
      lookup('hooks.example.com', {}, (error, address, family) => {
        try {
          expect(error).toBeNull();
          expect(address).toBe('203.0.113.10');
          expect(family).toBe(4);
          resolve();
        } catch (caught) {
          reject(caught);
        }
      });
    });
  });
});

describe('secureCookieOptions', () => {
  it('sets httpOnly cookies and tightens flags in production', async () => {
    const production = loadConfig({
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      STORAGE_SIGNING_SECRET: 'c'.repeat(32),
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hackathon',
      REDIS_URL: 'redis://localhost:6379',
      FEATURE_AI: 'false',
      AI_ENABLED: 'false',
      DEMO_MODE: 'false',
    });
    const development = loadConfig({ NODE_ENV: 'development' });

    expect(secureCookieOptions(development)).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
    expect(secureCookieOptions(production)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  });
});
