import { describe, expect, it } from 'vitest';

import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('defaults to false so clients cannot spoof X-Forwarded-For', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('0')).toBe(false);
    expect(parseTrustProxy('off')).toBe(false);
  });

  it('parses hop counts, booleans, and subnet strings', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('on')).toBe(true);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('loopback')).toBe('loopback');
  });
});
