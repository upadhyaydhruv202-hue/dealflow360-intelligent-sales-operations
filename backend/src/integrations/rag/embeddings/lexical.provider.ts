import { createHash } from 'node:crypto';

import { RAG } from '../../../constants';
import { l2Normalize } from '../rag.similarity';
import type { EmbeddingProvider } from '../rag.types';

export const LEXICAL_EMBEDDING_DIMENSIONS = RAG.LEXICAL_EMBEDDING_DIMENSIONS;

/**
 * Deterministic bag-of-tokens embedding for tests, CI, and mock/demo RAG.
 * Overlapping vocabulary produces similar vectors; it is not a substitute for a real model.
 */
export class LexicalEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'lexical';
  readonly dimensions: number;

  constructor(dimensions = LEXICAL_EMBEDDING_DIMENSIONS) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    return lexicalEmbedding(text, this.dimensions);
  }
}

export function lexicalEmbedding(text: string, dimensions: number = LEXICAL_EMBEDDING_DIMENSIONS): number[] {
  const tokens = tokenize(text);
  const values = new Array<number>(dimensions).fill(0);

  if (tokens.length === 0) {
    return values;
  }

  for (const token of tokens) {
    const digest = createHash('sha256').update(token).digest();
    for (let index = 0; index < dimensions; index += 1) {
      const byte = digest[index % digest.length] ?? 0;
      values[index] += byte / 127.5 - 1;
    }
  }

  return l2Normalize(values);
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'for',
  'from',
  'how',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'what',
  'when',
  'where',
  'with',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token));
}
