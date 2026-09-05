import { wrapUntrustedData } from '../ai/guardrails';
import type { AssembledContext, RetrievedChunk } from './rag.types';

export interface AssembleContextOptions {
  maxChars: number;
  chunks: RetrievedChunk[];
}

export function assembleContext(options: AssembleContextOptions): AssembledContext {
  const selected: RetrievedChunk[] = [];
  const parts: string[] = [];
  let usedChars = 0;
  let truncated = false;

  for (const chunk of options.chunks) {
    const block = formatChunkBlock(chunk);
    const next = usedChars + block.length + (parts.length > 0 ? 2 : 0);
    if (next > options.maxChars) {
      truncated = true;
      break;
    }
    parts.push(block);
    selected.push(chunk);
    usedChars = next;
  }

  const body = parts.join('\n\n');
  const prompt = wrapUntrustedData('document', body.length > 0 ? body : '(no retrieved chunks)');

  return {
    prompt,
    usedChars: prompt.length,
    chunks: selected,
    truncated,
  };
}

export function formatChunkBlock(chunk: RetrievedChunk): string {
  const score = Number(chunk.score.toFixed(4));
  return [
    `[chunk chunkId=${chunk.chunkId} documentId=${chunk.documentId} source=${escapeAttr(chunk.source)} score=${score}]`,
    chunk.content,
    '[/chunk]',
  ].join('\n');
}

function escapeAttr(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').slice(0, 256);
}
