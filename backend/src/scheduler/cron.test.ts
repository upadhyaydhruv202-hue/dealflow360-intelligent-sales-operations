import { describe, expect, it } from 'vitest';

import { assertValidCron, matchesCron } from './cron';

function utc(iso: string): Date {
  return new Date(iso);
}

describe('cron', () => {
  it('matches wildcard every minute', () => {
    expect(matchesCron('* * * * *', utc('2026-08-28T12:34:56.000Z'))).toBe(true);
  });

  it('matches a specific minute', () => {
    expect(matchesCron('0 * * * *', utc('2026-08-28T12:00:10.000Z'))).toBe(true);
    expect(matchesCron('0 * * * *', utc('2026-08-28T12:01:00.000Z'))).toBe(false);
  });

  it('matches steps, ranges, and lists', () => {
    expect(matchesCron('*/5 * * * *', utc('2026-08-28T00:10:00.000Z'))).toBe(true);
    expect(matchesCron('*/5 * * * *', utc('2026-08-28T00:11:00.000Z'))).toBe(false);
    expect(matchesCron('0 9-17 * * 1-5', utc('2026-08-28T09:00:00.000Z'))).toBe(true);
    expect(matchesCron('0 9-17 * * 1-5', utc('2026-08-30T09:00:00.000Z'))).toBe(false);
    expect(matchesCron('0,30 * * * *', utc('2026-08-28T04:30:00.000Z'))).toBe(true);
    expect(matchesCron('0,30 * * * *', utc('2026-08-28T04:15:00.000Z'))).toBe(false);
  });

  it('treats weekday 7 as Sunday', () => {
    expect(matchesCron('0 0 * * 7', utc('2026-08-30T00:00:00.000Z'))).toBe(true);
    expect(matchesCron('0 0 * * 0', utc('2026-08-30T00:00:00.000Z'))).toBe(true);
    expect(matchesCron('0 0 * * 7', utc('2026-08-31T00:00:00.000Z'))).toBe(false);
  });

  it('rejects invalid expressions', () => {
    expect(() => assertValidCron('* * *')).toThrow(/5 fields/);
    expect(() => assertValidCron('60 * * * *')).toThrow(/Invalid cron field/);
    expect(() => assertValidCron('0 24 * * *')).toThrow(/Invalid cron field/);
    expect(() => assertValidCron('0 * * * 8')).toThrow(/Invalid cron field/);
    expect(() => assertValidCron('1- * * * *')).toThrow(/Invalid cron field/);
  });
});
