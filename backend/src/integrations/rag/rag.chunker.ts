import { RAG } from '../../constants';
import { ValidationError } from '../../errors';
import type { Chunker, TextChunk } from './rag.types';

export interface RecursiveChunkerOptions {
  chunkSize?: number;
  overlap?: number;
  maxChunks?: number;
}

const SEPARATORS = ['\n\n', '\n', '. ', ' ', ''] as const;

export class RecursiveCharacterChunker implements Chunker {
  private readonly chunkSize: number;
  private readonly overlap: number;
  private readonly maxChunks: number;

  constructor(options: RecursiveChunkerOptions = {}) {
    this.chunkSize = options.chunkSize ?? RAG.DEFAULT_CHUNK_SIZE;
    this.overlap = Math.min(options.overlap ?? RAG.DEFAULT_CHUNK_OVERLAP, this.chunkSize - 1);
    this.maxChunks = options.maxChunks ?? RAG.MAX_CHUNKS_PER_DOCUMENT;
  }

  chunk(text: string): TextChunk[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    const pieces = this.split(normalized, 0);
    const merged = this.merge(pieces);
    if (merged.length > this.maxChunks) {
      throw new ValidationError('Document produced too many chunks', [
        {
          path: 'text',
          message: `Must produce at most ${this.maxChunks} chunks at the current chunk size`,
          code: 'too_big',
        },
      ]);
    }

    return merged.map((content, chunkIndex) => ({ chunkIndex, content }));
  }

  private split(text: string, separatorIndex: number): string[] {
    if (text.length <= this.chunkSize) {
      return [text];
    }

    const separator = SEPARATORS[separatorIndex] ?? '';
    if (separator === '') {
      const hard: string[] = [];
      for (let offset = 0; offset < text.length; offset += this.chunkSize) {
        hard.push(text.slice(offset, offset + this.chunkSize));
      }
      return hard;
    }

    const parts = text.split(separator).filter((part) => part.length > 0);
    const nextIndex = Math.min(separatorIndex + 1, SEPARATORS.length - 1);
    const out: string[] = [];
    for (const part of parts) {
      if (part.length <= this.chunkSize) {
        out.push(part);
      } else {
        out.push(...this.split(part, nextIndex));
      }
    }
    return out;
  }

  private merge(pieces: string[]): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const piece of pieces) {
      const candidate = current ? `${current} ${piece}`.replace(/\s+/g, ' ').trim() : piece;
      if (candidate.length <= this.chunkSize) {
        current = candidate;
        continue;
      }

      if (current) {
        chunks.push(current);
        current = this.withOverlap(current, piece);
      } else {
        chunks.push(piece.slice(0, this.chunkSize));
        current = piece.slice(Math.max(0, piece.length - this.overlap));
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks.map((item) => item.trim()).filter((item) => item.length > 0);
  }

  private withOverlap(previous: string, next: string): string {
    if (this.overlap <= 0) {
      return next;
    }

    const tail = previous.slice(Math.max(0, previous.length - this.overlap));
    const joined = `${tail} ${next}`.replace(/\s+/g, ' ').trim();
    return joined.length <= this.chunkSize ? joined : next;
  }
}

export function createChunker(options: RecursiveChunkerOptions = {}): RecursiveCharacterChunker {
  return new RecursiveCharacterChunker(options);
}
