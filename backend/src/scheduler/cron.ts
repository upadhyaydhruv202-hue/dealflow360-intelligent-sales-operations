const CRON_FIELDS = 5;

const RANGES = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12 },
  { min: 0, max: 7 },
] as const;

export function assertValidCron(expression: string): string {
  const parts = splitCron(expression);
  for (let index = 0; index < parts.length; index += 1) {
    const range = RANGES[index];
    if (!isValidField(parts[index], range.min, range.max)) {
      throw new Error(`Invalid cron field "${parts[index]}" in "${expression}"`);
    }
  }
  return parts.join(' ');
}

export function matchesCron(expression: string, date: Date): boolean {
  const parts = splitCron(expression);
  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const dow = date.getUTCDay();

  return (
    fieldMatches(parts[0], minute, RANGES[0].min, RANGES[0].max) &&
    fieldMatches(parts[1], hour, RANGES[1].min, RANGES[1].max) &&
    fieldMatches(parts[2], day, RANGES[2].min, RANGES[2].max) &&
    fieldMatches(parts[3], month, RANGES[3].min, RANGES[3].max) &&
    matchesDayOfWeek(parts[4], dow)
  );
}

function matchesDayOfWeek(expr: string, dow: number): boolean {
  return fieldMatches(expr, dow, 0, 7) || (dow === 0 && fieldMatches(expr, 7, 0, 7));
}

function splitCron(expression: string): string[] {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== CRON_FIELDS) {
    throw new Error(`Cron expressions must have ${CRON_FIELDS} fields (minute hour day month weekday)`);
  }
  return parts;
}

function isValidField(expr: string, min: number, max: number): boolean {
  if (expr === '*') {
    return true;
  }

  return expr.split(',').every((part) => isValidListItem(part, min, max));
}

function isValidListItem(part: string, min: number, max: number): boolean {
  const [range, stepRaw] = splitStep(part);
  if (stepRaw !== undefined) {
    const step = Number(stepRaw);
    if (!Number.isInteger(step) || step < 1) {
      return false;
    }
  }

  if (range === '*') {
    return true;
  }

  if (range.includes('-')) {
    const bounds = range.split('-');
    if (bounds.length !== 2) {
      return false;
    }
    const start = Number(bounds[0]);
    const end = Number(bounds[1]);
    return Number.isInteger(start) && Number.isInteger(end) && start >= min && end <= max && start <= end;
  }

  const value = Number(range);
  return Number.isInteger(value) && value >= min && value <= max;
}

function fieldMatches(expr: string, value: number, min: number, max: number): boolean {
  if (expr === '*') {
    return true;
  }

  return expr.split(',').some((part) => listItemMatches(part, value, min, max));
}

function listItemMatches(part: string, value: number, min: number, max: number): boolean {
  const [range, stepRaw] = splitStep(part);
  const step = stepRaw === undefined ? 1 : Number(stepRaw);
  if (!Number.isInteger(step) || step < 1) {
    return false;
  }

  let start: number;
  let end: number;
  if (range === '*') {
    start = min;
    end = max;
  } else if (range.includes('-')) {
    const bounds = range.split('-');
    if (bounds.length !== 2) {
      return false;
    }
    start = Number(bounds[0]);
    end = Number(bounds[1]);
  } else {
    start = Number(range);
    end = start;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
    return false;
  }

  if (value < start || value > end) {
    return false;
  }

  return (value - start) % step === 0;
}

function splitStep(part: string): [string, string | undefined] {
  const index = part.indexOf('/');
  if (index < 0) {
    return [part, undefined];
  }
  return [part.slice(0, index), part.slice(index + 1)];
}
