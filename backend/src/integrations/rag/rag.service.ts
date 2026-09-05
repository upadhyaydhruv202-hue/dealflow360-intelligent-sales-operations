import { createHash, randomUUID } from 'node:crypto';

import { JOBS, RAG } from '../../constants';
import {
  ExternalServiceError,
  FeatureDisabledError,
  NotFoundError,
  ValidationError,
} from '../../errors';
import { isFeatureEnabled } from '../../features';
import type { JobQueue } from '../../jobs/queue';
import { parseWithSchema } from '../../schemas/parse';
import type { AppConfig } from '../../types/config';
import type { AppLogger } from '../../utils/logger';
import type { AuditService } from '../../audit/audit.service';
import { detectPromptInjection } from '../ai/guardrails';
import type { AIService } from '../ai';
import { AiEmbeddingProvider } from './embeddings/ai.provider';
import { LexicalEmbeddingProvider } from './embeddings/lexical.provider';
import { RAG_ANSWER_PROMPT } from './prompts/answer';
import { createChunker, type RecursiveChunkerOptions } from './rag.chunker';
import { resolveRagRuntimeConfig, type RagRuntimeConfig } from './rag.config';
import { assembleContext } from './rag.context';
import { applyGroundingPolicy, insufficientEvidenceAnswer } from './rag.grounding';
import { createRetriever, type SimilarityRetriever } from './rag.retriever';
import {
  ragAnswerModelSchema,
  ragAskBodySchema,
  ragIndexBodySchema,
  ragIndexJobPayloadSchema,
  ragSearchBodySchema,
} from './rag.schemas';
import { createMemoryVectorStore } from './stores/memory.store';
import { createPostgresVectorStore } from './stores/postgres.store';
import type { RagRepository } from '../../repositories/rag.repository';
import type {
  Chunker,
  EmbeddingProvider,
  RagAnswer,
  RagAskInput,
  RagIndexInput,
  RagIndexResult,
  RagSearchInput,
  RetrievedChunk,
  StoredChunk,
  VectorStore,
} from './rag.types';
import { RAG_INDEX_JOB } from './rag.types';

export interface RagServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  ai: AIService;
  store?: VectorStore;
  embeddings?: EmbeddingProvider;
  chunker?: Chunker;
  jobs?: JobQueue | null;
  audit?: AuditService | null;
  ragDocuments?: RagRepository | null;
  runtime?: RagRuntimeConfig;
}

export class RagService {
  readonly runtime: RagRuntimeConfig;
  private readonly store: VectorStore;
  private readonly embeddings: EmbeddingProvider;
  private readonly chunker: Chunker;
  private readonly retriever: SimilarityRetriever;
  private readonly ai: AIService;
  private readonly jobs: JobQueue | null;
  private readonly audit: AuditService | null;
  private readonly logger: AppLogger;
  private readonly config: AppConfig;

  constructor(options: RagServiceOptions) {
    this.config = options.config;
    this.logger = options.logger;
    this.ai = options.ai;
    this.jobs = options.jobs ?? null;
    this.audit = options.audit ?? null;
    this.runtime = options.runtime ?? resolveRagRuntimeConfig(options.config);
    this.embeddings = options.embeddings ?? defaultEmbeddings(options.ai);
    this.chunker = options.chunker ?? createChunker(chunkerOptions(this.runtime));
    this.store =
      options.store ??
      defaultStore({
        runtime: this.runtime,
        documents: options.ragDocuments ?? null,
        logger: options.logger,
      });
    this.retriever = createRetriever({
      embeddings: this.embeddings,
      store: this.store,
      defaultTopK: this.runtime.topK,
      defaultMinScore: this.runtime.minScore,
    });
  }

  get enabled(): boolean {
    return isFeatureEnabled(this.config, 'rag');
  }

  registerJobs(): void {
    this.jobs?.process(RAG_INDEX_JOB, async (payload) => {
      const job = parseWithSchema(ragIndexJobPayloadSchema, payload, {
        source: 'job',
        message: 'Invalid RAG index job payload',
      });
      await this.indexNow({
        documentId: job.documentId,
        source: job.source,
        text: job.text,
        metadata: job.metadata,
        userId: job.userId,
      });
    });
  }

  async index(input: RagIndexInput): Promise<RagIndexResult> {
    this.assertReady();
    const parsed = parseWithSchema(ragIndexBodySchema, input, {
      source: 'body',
      message: 'Invalid RAG index request',
    });
    assertDocumentSize(parsed.text, this.runtime.maxDocumentChars);
    const documentId = parsed.documentId ?? randomUUID();
    const shouldQueue =
      parsed.async === true ||
      (parsed.async !== false &&
        parsed.text.length >= this.runtime.asyncThresholdChars &&
        Boolean(this.jobs));

    if (shouldQueue) {
      if (!this.jobs) {
        throw new ExternalServiceError('Job queue is not configured', { provider: 'jobs' });
      }

      const jobId = await this.jobs.enqueue(
        RAG_INDEX_JOB,
        {
          documentId,
          source: parsed.source,
          text: parsed.text,
          metadata: parsed.metadata ?? {},
          userId: input.userId,
        },
        {
          attempts: JOBS.DEFAULT_ATTEMPTS,
          backoffMs: JOBS.DEFAULT_BACKOFF_MS,
          timeoutMs: JOBS.DEFAULT_TIMEOUT_MS,
        },
      );

      return { documentId, chunkCount: 0, status: 'processing', jobId };
    }

    return this.indexNow({
      documentId,
      source: parsed.source,
      text: parsed.text,
      metadata: parsed.metadata,
      userId: input.userId,
    });
  }

  async getDocument(documentId: string, userId?: string) {
    this.assertReady();
    const document = await this.store.getDocument(documentId);
    if (!document || !ownsRagDocument(document.createdBy, userId)) {
      throw new NotFoundError('RAG document not found', { documentId });
    }

    return document;
  }

  async deleteDocument(
    documentId: string,
    userId?: string,
  ): Promise<{ documentId: string; deleted: true }> {
    this.assertReady();
    const document = await this.store.getDocument(documentId);
    if (!document || !ownsRagDocument(document.createdBy, userId)) {
      throw new NotFoundError('RAG document not found', { documentId });
    }
    await this.store.deleteDocument(documentId);
    await this.audit?.record({
      action: RAG.AUDIT_DELETE,
      resource: 'rag_document',
      resourceId: documentId,
      status: 'succeeded',
      metadata: {},
    });
    return { documentId, deleted: true };
  }

  async search(input: RagSearchInput): Promise<{ query: string; chunks: RetrievedChunk[] }> {
    this.assertReady();
    const parsed = parseWithSchema(ragSearchBodySchema, input, {
      source: 'body',
      message: 'Invalid RAG search request',
    });
    const chunks = await this.retriever.retrieve(parsed.query, {
      topK: parsed.topK,
      minScore: parsed.minScore,
      documentIds: parsed.documentIds,
      createdBy: input.userId,
    });
    return { query: parsed.query, chunks };
  }

  async ask(input: RagAskInput): Promise<RagAnswer> {
    this.assertReady();
    const parsed = parseWithSchema(ragAskBodySchema, input, {
      source: 'body',
      message: 'Invalid RAG ask request',
    });
    const queryInjection = detectPromptInjection(parsed.query);
    const retrieved = await this.retriever.retrieve(parsed.query, {
      topK: parsed.topK,
      minScore: parsed.minScore,
      documentIds: parsed.documentIds,
      createdBy: input.userId,
    });
    const chunkSignals = retrieved.flatMap((chunk) => detectPromptInjection(chunk.content).signals);
    const injectionSignals = unique([
      ...queryInjection.signals.map((signal) => `query:${signal}`),
      ...chunkSignals.map((signal) => `chunk:${signal}`),
    ]);

    if (retrieved.length === 0) {
      await this.auditAsk(input.userId, parsed.query, {
        grounded: false,
        chunkCount: 0,
        injectionSignals,
      });
      return { ...insufficientEvidenceAnswer(injectionSignals) };
    }

    const assembled = assembleContext({
      maxChars: this.runtime.maxContextChars,
      chunks: retrieved,
    });
    const prompt = RAG_ANSWER_PROMPT.build({
      question: parsed.query,
      context: assembled.prompt,
      injectionWarning: injectionSignals.length > 0,
    });

    const generated = await this.ai.generateStructured({
      system: prompt.system,
      prompt: prompt.prompt,
      schema: ragAnswerModelSchema,
      schemaName: 'ragAnswer',
      temperature: 0.1,
    });

    const grounded = applyGroundingPolicy(generated.data, assembled.chunks);
    const answer: RagAnswer = { ...grounded, injectionSignals };

    await this.auditAsk(input.userId, parsed.query, {
      grounded: answer.grounded,
      chunkCount: assembled.chunks.length,
      injectionSignals,
    });

    return answer;
  }

  private async indexNow(input: {
    documentId: string;
    source: string;
    text: string;
    metadata?: RagIndexInput['metadata'];
    userId?: string;
  }): Promise<RagIndexResult> {
    assertDocumentSize(input.text, this.runtime.maxDocumentChars);

    const injection = detectPromptInjection(input.text);
    const pieces = this.chunker.chunk(input.text);
    if (pieces.length === 0) {
      throw new ValidationError('Document produced no chunks', [
        { path: 'text', message: 'Provide text that can be split into chunks', code: 'custom' },
      ]);
    }

    const chunks: StoredChunk[] = [];
    for (const piece of pieces) {
      const embedding = await this.embeddings.embed(piece.content);
      chunks.push({
        chunkId: `${input.documentId}:${String(piece.chunkIndex).padStart(4, '0')}`,
        documentId: input.documentId,
        chunkIndex: piece.chunkIndex,
        source: input.source,
        content: piece.content,
        metadata: {
          ...(input.metadata ?? {}),
          chunkIndex: piece.chunkIndex,
          ...(injection.suspicious ? { injection: true } : {}),
        },
        embedding,
        embeddingModel: this.embeddings.name,
      });
    }

    await this.store.upsertDocument({
      documentId: input.documentId,
      source: input.source,
      metadata: input.metadata ?? {},
      textHash: hashText(input.text),
      chunks,
      createdBy: input.userId,
    });

    this.logger.info(
      {
        module: 'rag',
        operation: 'index',
        documentId: input.documentId,
        chunkCount: chunks.length,
        embeddingProvider: this.embeddings.name,
        injectionSignals: injection.signals,
      },
      'RAG document indexed',
    );

    await this.audit?.record({
      actorId: input.userId,
      action: RAG.AUDIT_INDEX,
      resource: 'rag_document',
      resourceId: input.documentId,
      status: 'succeeded',
      metadata: {
        chunkCount: chunks.length,
        source: input.source,
        injection: injection.suspicious,
      },
    });

    return { documentId: input.documentId, chunkCount: chunks.length, status: 'indexed' };
  }

  private async auditAsk(
    userId: string | undefined,
    query: string,
    details: { grounded: boolean; chunkCount: number; injectionSignals: string[] },
  ): Promise<void> {
    await this.audit?.record({
      actorId: userId,
      action: RAG.AUDIT_ASK,
      resource: 'rag',
      status: details.grounded ? 'succeeded' : 'ungrounded',
      metadata: {
        queryChars: query.length,
        chunkCount: details.chunkCount,
        grounded: details.grounded,
        injectionSignals: details.injectionSignals,
      },
    });
  }

  private assertReady(): void {
    if (!this.enabled) {
      throw new FeatureDisabledError('rag');
    }

    if (!this.ai.ready) {
      throw new ExternalServiceError('AI is not configured', { provider: 'ai' });
    }
  }
}

export function createRagService(options: RagServiceOptions): RagService {
  const service = new RagService(options);
  service.registerJobs();
  return service;
}

function defaultEmbeddings(ai: AIService): EmbeddingProvider {
  if (ai.runtime.provider === 'mock' || ai.runtime.requestedProvider === 'mock') {
    return new LexicalEmbeddingProvider();
  }

  return new AiEmbeddingProvider(ai);
}

function defaultStore(options: {
  runtime: RagRuntimeConfig;
  documents: RagRepository | null;
  logger: AppLogger;
}): VectorStore {
  if (options.runtime.vectorStore === 'postgres' && options.documents) {
    return createPostgresVectorStore(options.documents);
  }

  if (options.runtime.vectorStore === 'postgres') {
    options.logger.warn(
      'RAG_VECTOR_STORE=postgres but no database is configured; using in-memory vectors',
    );
  }

  return createMemoryVectorStore();
}

function chunkerOptions(runtime: RagRuntimeConfig): RecursiveChunkerOptions {
  return {
    chunkSize: runtime.chunkSize,
    overlap: runtime.chunkOverlap,
    maxChunks: runtime.maxChunksPerDocument,
  };
}

function assertDocumentSize(text: string, maxDocumentChars: number): void {
  if (text.length > maxDocumentChars) {
    throw new ValidationError('Document exceeds the RAG size limit', [
      { path: 'text', message: `Must be at most ${maxDocumentChars} characters`, code: 'too_big' },
    ]);
  }
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function ownsRagDocument(createdBy: string | undefined, userId: string | undefined): boolean {
  if (!userId) {
    return true;
  }

  return createdBy === userId;
}
