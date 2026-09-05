import { JOB_NAMES } from '../../constants';

export const RAG_INDEX_JOB = JOB_NAMES.RAG_INDEX;

export const RAG_VECTOR_STORES = ['memory', 'postgres'] as const;
export type RagVectorStoreName = (typeof RAG_VECTOR_STORES)[number];

export type RagChunkMetadata = Record<string, string | number | boolean | null>;

export interface TextChunk {
  chunkIndex: number;
  content: string;
}

export interface Chunker {
  chunk(text: string): TextChunk[];
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
}

export interface StoredChunk {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  source: string;
  content: string;
  metadata: RagChunkMetadata;
  embedding: number[];
  embeddingModel: string;
}

export interface ScoredChunk extends StoredChunk {
  score: number;
}

export interface RetrievedChunk {
  documentId: string;
  chunkId: string;
  source: string;
  content: string;
  metadata: RagChunkMetadata;
  score: number;
}

export interface VectorQueryOptions {
  topK: number;
  documentIds?: string[];
  createdBy?: string;
  minScore?: number;
}

export interface UpsertDocumentInput {
  documentId: string;
  source: string;
  metadata: RagChunkMetadata;
  textHash: string;
  chunks: StoredChunk[];
  createdBy?: string;
}

export interface IndexedDocumentMeta {
  documentId: string;
  source: string;
  metadata: RagChunkMetadata;
  chunkCount: number;
  textHash: string;
  createdBy?: string;
}

export interface VectorStore {
  upsertDocument(input: UpsertDocumentInput): Promise<void>;
  deleteDocument(documentId: string): Promise<void>;
  getDocument(documentId: string): Promise<IndexedDocumentMeta | null>;
  query(embedding: number[], options: VectorQueryOptions): Promise<ScoredChunk[]>;
}

export interface RetrieveOptions {
  topK?: number;
  minScore?: number;
  documentIds?: string[];
  createdBy?: string;
}

export interface Retriever {
  retrieve(query: string, options?: RetrieveOptions): Promise<RetrievedChunk[]>;
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

export interface RagIndexInput {
  documentId?: string;
  source: string;
  text: string;
  metadata?: RagChunkMetadata;
  userId?: string;
  async?: boolean;
}

export interface RagIndexResult {
  documentId: string;
  chunkCount: number;
  status: 'indexed' | 'processing';
  jobId?: string;
}

export interface RagSearchInput {
  query: string;
  topK?: number;
  minScore?: number;
  documentIds?: string[];
  userId?: string;
}

export interface RagAskInput extends RagSearchInput {
  userId?: string;
}

export interface AssembledContext {
  prompt: string;
  usedChars: number;
  chunks: RetrievedChunk[];
  truncated: boolean;
}
