import { SEMVER_PATTERN } from './version';

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: readonly (string | number)[];
  raw: string;
}

export function parseSemver(version: string): ParsedSemver | null {
  const match = SEMVER_PATTERN.exec(version.trim());
  if (!match) {
    return null;
  }

  const prerelease = match[4]
    ? match[4].split('.').map((part) => (/^(0|[1-9]\d*)$/.test(part) ? Number(part) : part))
    : [];

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
    raw: version.trim(),
  };
}

export function compareSemver(left: string, right: string): number {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);
  if (!parsedLeft || !parsedRight) {
    return compareStrings(left, right);
  }
  return compareParsed(parsedLeft, parsedRight);
}

/**
 * npm-style range: `*`, exact, `^`, `~`, `>=` `>` `<=` `<` `=`,
 * space-separated AND, `||` OR. No hyphen ranges.
 */
export function satisfiesSemver(version: string, range: string): boolean {
  const parsed = parseSemver(version);
  const trimmed = range.trim();
  if (!trimmed || trimmed === '*') {
    return parsed !== null;
  }
  if (!parsed) {
    return false;
  }

  return trimmed.split('||').some((clause) => clauseSatisfied(parsed, clause.trim()));
}

function clauseSatisfied(version: ParsedSemver, clause: string): boolean {
  if (!clause || clause === '*') {
    return true;
  }

  const tokens = clause.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => comparatorSatisfied(version, token));
}

function comparatorSatisfied(version: ParsedSemver, token: string): boolean {
  if (token === '*') {
    return true;
  }

  const match = /^(>=|<=|>|<|=|\^|~)?(.+)$/.exec(token);
  if (!match) {
    return false;
  }

  const operator = match[1] || '=';
  const boundRaw = match[2]?.trim() ?? '';
  if (boundRaw === '*') {
    return true;
  }

  const bound = parseSemver(boundRaw);
  if (!bound) {
    return false;
  }

  if (operator === '^') {
    return compareParsed(version, bound) >= 0 && compareParsed(version, caretUpper(bound)) < 0;
  }
  if (operator === '~') {
    return compareParsed(version, bound) >= 0 && compareParsed(version, tildeUpper(bound)) < 0;
  }

  const compared = compareParsed(version, bound);
  switch (operator) {
    case '>':
      return compared > 0;
    case '>=':
      return compared >= 0;
    case '<':
      return compared < 0;
    case '<=':
      return compared <= 0;
    default:
      return compared === 0;
  }
}

function caretUpper(bound: ParsedSemver): ParsedSemver {
  if (bound.major > 0) {
    return { major: bound.major + 1, minor: 0, patch: 0, prerelease: [], raw: '' };
  }
  if (bound.minor > 0) {
    return { major: 0, minor: bound.minor + 1, patch: 0, prerelease: [], raw: '' };
  }
  return { major: 0, minor: 0, patch: bound.patch + 1, prerelease: [], raw: '' };
}

function tildeUpper(bound: ParsedSemver): ParsedSemver {
  return { major: bound.major, minor: bound.minor + 1, patch: 0, prerelease: [], raw: '' };
}

function compareParsed(left: ParsedSemver, right: ParsedSemver): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  if (left.patch !== right.patch) {
    return left.patch - right.patch;
  }

  const leftPre = left.prerelease;
  const rightPre = right.prerelease;
  if (leftPre.length === 0 && rightPre.length === 0) {
    return 0;
  }
  if (leftPre.length === 0) {
    return 1;
  }
  if (rightPre.length === 0) {
    return -1;
  }

  const limit = Math.max(leftPre.length, rightPre.length);
  for (let index = 0; index < limit; index += 1) {
    const leftPart = leftPre[index];
    const rightPart = rightPre[index];
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    const compared = comparePrereleaseIdent(leftPart, rightPart);
    if (compared !== 0) {
      return compared;
    }
  }
  return 0;
}

function comparePrereleaseIdent(left: string | number, right: string | number): number {
  const leftNumeric = typeof left === 'number';
  const rightNumeric = typeof right === 'number';
  if (leftNumeric && rightNumeric) {
    return left - right;
  }
  if (leftNumeric) {
    return -1;
  }
  if (rightNumeric) {
    return 1;
  }
  return compareStrings(String(left), String(right));
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
