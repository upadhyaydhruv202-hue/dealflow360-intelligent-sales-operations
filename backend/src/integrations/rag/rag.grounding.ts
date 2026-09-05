import { RAG } from '../../constants';
import type { RagAnswer, RagAnswerSource, RetrievedChunk } from './rag.types';

export const INSUFFICIENT_EVIDENCE_ANSWER =
  'I do not have enough retrieved evidence to answer that. Index relevant documents or try a more specific question.';

export function insufficientEvidenceAnswer(injectionSignals: string[] = []): RagAnswer {
  return {
    answer: INSUFFICIENT_EVIDENCE_ANSWER,
    grounded: false,
    confidence: 0,
    sources: [],
    unsupported: [],
    injectionSignals,
  };
}

export function applyGroundingPolicy(
  raw: {
    answer: string;
    grounded: boolean;
    confidence: number;
    sources?: Array<{ documentId: string; chunkId: string; quote?: string }>;
    unsupported?: string[];
  },
  retrieved: RetrievedChunk[],
): RagAnswer {
  const allowed = new Map(retrieved.map((chunk) => [chunk.chunkId, chunk]));
  const sources: RagAnswerSource[] = [];

  for (const cited of raw.sources ?? []) {
    const chunk = allowed.get(cited.chunkId);
    if (!chunk || chunk.documentId !== cited.documentId) {
      continue;
    }

    sources.push({
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      source: chunk.source,
      quote: clipQuote(cited.quote ?? chunk.content),
      score: chunk.score,
    });
  }

  const grounded = raw.grounded && sources.length > 0;
  const confidence = grounded ? clamp01(raw.confidence) : Math.min(clamp01(raw.confidence), RAG.UNGROUNDED_MAX_CONFIDENCE);

  return {
    answer: grounded ? raw.answer.trim() : ungroundedAnswer(raw.answer),
    grounded,
    confidence,
    sources,
    unsupported: grounded ? (raw.unsupported ?? []).slice(0, 12) : ['Retrieved evidence did not support a grounded answer.'],
    injectionSignals: [],
  };
}

function ungroundedAnswer(_answer: string): string {
  return INSUFFICIENT_EVIDENCE_ANSWER;
}

function clipQuote(value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.slice(0, RAG.MAX_QUOTE_CHARS);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
