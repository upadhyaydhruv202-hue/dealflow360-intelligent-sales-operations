import { SEARCH } from '../../constants';

const LIKE_ESCAPE = /([\\%_])/g;

export function tokenizeQuery(query: string): string[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .slice(0, SEARCH.MAX_TOKENS);

  return tokens.map((token) => token.slice(0, SEARCH.MAX_TOKEN_CHARS));
}

export function escapeLike(value: string): string {
  return value.replace(LIKE_ESCAPE, '\\$1');
}

export function shouldAttemptFuzzy(query: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0 || tokens.length > SEARCH.FUZZY_MAX_TOKENS) {
    return false;
  }
  return tokens.every(
    (token) => token.length >= SEARCH.FUZZY_MIN_TOKEN_CHARS && token.length <= SEARCH.MAX_TOKEN_CHARS,
  ) && query.length <= 64;
}

export function trigramSimilarity(left: string, right: string): number {
  const a = trigrams(left);
  const b = trigrams(right);
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const gram of a) {
    if (b.has(gram)) {
      intersection += 1;
    }
  }
  return intersection / (a.size + b.size - intersection);
}

export function keywordScore(haystack: string, tokens: readonly string[], boost = 1): number {
  if (tokens.length === 0) {
    return 0;
  }
  const normalized = haystack.toLowerCase();
  let hits = 0;
  for (const token of tokens) {
    if (normalized.includes(token.toLowerCase())) {
      hits += 1;
    }
  }
  return (hits / tokens.length) * boost;
}

export function matchesAllTokens(haystack: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) {
    return true;
  }
  const normalized = haystack.toLowerCase();
  return tokens.every((token) => normalized.includes(token.toLowerCase()));
}

export function highlightSnippets(text: string, tokens: readonly string[]): string[] {
  if (!text.trim() || tokens.length === 0) {
    return [];
  }

  const snippet = collapseWhitespace(text).slice(0, SEARCH.MAX_HIGHLIGHT_CHARS);
  const flags = tokens.map((token) => escapeRegExp(token)).filter(Boolean);
  if (flags.length === 0) {
    return snippet ? [snippet] : [];
  }

  const pattern = new RegExp(`(${flags.join('|')})`, 'ig');
  const highlighted = snippet.replace(pattern, '**$1**');
  return highlighted.trim() ? [highlighted] : [];
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value.toLowerCase()} `;
  const grams = new Set<string>();
  for (let index = 0; index < padded.length - 2; index += 1) {
    grams.add(padded.slice(index, index + 3));
  }
  return grams;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
