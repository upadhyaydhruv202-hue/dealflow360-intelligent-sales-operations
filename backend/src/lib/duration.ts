const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/i;

export function parseDurationToMs(value: string): number {
  const trimmed = value.trim();
  const match = DURATION_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid duration "${value}". Use a compact value such as 15m, 7d, or 30s.`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return amount * UNIT_MS[unit];
}

export function parseDurationToSeconds(value: string): number {
  return Math.floor(parseDurationToMs(value) / 1000);
}
