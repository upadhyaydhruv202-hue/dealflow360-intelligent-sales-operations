import { describe, expect, it } from 'vitest';

import { parseDurationToMs, parseDurationToSeconds } from './duration';

describe('parseDurationToMs', () => {
  it('parses compact duration units', () => {
    expect(parseDurationToMs('15m')).toBe(15 * 60_000);
    expect(parseDurationToMs('7d')).toBe(7 * 86_400_000);
    expect(parseDurationToMs('30s')).toBe(30_000);
    expect(parseDurationToMs('1h')).toBe(3_600_000);
    expect(parseDurationToMs('250ms')).toBe(250);
  });

  it('rejects unknown formats', () => {
    expect(() => parseDurationToMs('15 minutes')).toThrow(/Invalid duration/);
    expect(() => parseDurationToMs('')).toThrow(/Invalid duration/);
  });
});

describe('parseDurationToSeconds', () => {
  it('converts to whole seconds', () => {
    expect(parseDurationToSeconds('15m')).toBe(900);
  });
});
