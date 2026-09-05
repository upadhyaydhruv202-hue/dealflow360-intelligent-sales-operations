import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';

export interface RagIndexedDocument {
  documentId: string;
  chunkCount: number;
  status: 'indexed' | 'processing';
  jobId?: string;
}

export interface RagSearchHit {
  documentId: string;
  chunkId: string;
  source: string;
  content: string;
  score: number;
}

export interface RagAnswerSource {
  documentId: string;
  chunkId: string;
  source: string;
  quote: string;
  score: number;
}

export interface RagAnswer {
  answer: string;
  grounded: boolean;
  confidence: number;
  sources: RagAnswerSource[];
  unsupported: string[];
  injectionSignals: string[];
}

export function indexRagDocument(
  input: { documentId?: string; source: string; text: string; async?: boolean },
  token: string,
): Promise<RagIndexedDocument> {
  return apiRequest<RagIndexedDocument>(API_PATHS.rag.index, {
    method: 'POST',
    token,
    body: input,
  });
}

export function searchRag(
  input: { query: string },
  token: string,
): Promise<{ query: string; chunks: RagSearchHit[] }> {
  return apiRequest(API_PATHS.rag.search, {
    method: 'POST',
    token,
    body: input,
  });
}

export function askRag(input: { query: string }, token: string): Promise<RagAnswer> {
  return apiRequest<RagAnswer>(API_PATHS.rag.ask, {
    method: 'POST',
    token,
    body: input,
  });
}
