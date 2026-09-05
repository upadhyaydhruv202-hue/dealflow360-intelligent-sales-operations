import { randomUUID } from 'node:crypto';

import { DOCUMENT, JOBS } from '../../constants';
import { ExternalServiceError } from '../../errors';
import { sanitizeErrorMessage } from '../../errors/sanitize';
import type { JobQueue } from '../../jobs/queue';
import type { DocumentRepository } from '../../repositories/document.repository';
import { parseWithSchema } from '../../schemas/parse';
import type { AppConfig } from '../../types/config';
import type { AppLogger } from '../../utils/logger';
import { getRequestId } from '../../utils/request-context';
import type { AIService } from '../ai/ai.service';
import { EXTRACT_PROMPT } from '../ai/prompts';
import { wrapUntrustedData } from '../ai/guardrails';
import type { StorageService } from '../storage/storage.service';
import { extractDocumentText, validateDocumentFile } from './document.files';
import { applyDocumentReview } from './document.review';
import { documentAnalyzeJobPayloadSchema, resolveDocumentFields } from './document.schemas';
import {
  DOCUMENT_ANALYZE_JOB,
  DOCUMENT_PROCESS_JOB,
  type DocumentAnalysisResult,
  type DocumentAnalyzeJobPayload,
  type DocumentStatusName,
  type DocumentTypeName,
  type UploadedDocumentInput,
  type ValidatedDocumentFile,
} from './document.types';

export interface DocumentIntelligenceOptions {
  config: AppConfig;
  logger: AppLogger;
  documents: Pick<
    DocumentRepository,
    'create' | 'findById' | 'findByIdForUser' | 'claimForProcessing' | 'updateStatus' | 'saveExtraction'
  >;
  storage: StorageService;
  ai: AIService | null;
  jobs?: JobQueue | null;
  onAnalyzed?: (event: DocumentAnalyzedEvent) => void | Promise<void>;
  onUploaded?: (event: DocumentUploadedEvent) => void | Promise<void>;
}

export interface DocumentAnalyzedEvent {
  documentId: string;
  userId: string;
  documentType: DocumentTypeName;
  status: DocumentStatusName;
  requiresReview: boolean;
  confidence: number;
}

export interface DocumentUploadedEvent {
  documentId: string;
  userId: string;
  documentType: DocumentTypeName;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AnalyzeDocumentInput {
  userId: string;
  file: UploadedDocumentInput;
  documentType: DocumentTypeName;
  fields?: string[];
  async?: boolean;
}

export class DocumentIntelligenceService {
  private readonly documents: DocumentIntelligenceOptions['documents'];
  private readonly storage: StorageService;
  private readonly ai: AIService | null;
  private readonly jobs: JobQueue | null;
  private readonly logger: AppLogger;
  private readonly config: AppConfig;
  private readonly onAnalyzed?: (event: DocumentAnalyzedEvent) => void | Promise<void>;
  private readonly onUploaded?: (event: DocumentUploadedEvent) => void | Promise<void>;

  constructor(options: DocumentIntelligenceOptions) {
    this.documents = options.documents;
    this.storage = options.storage;
    this.ai = options.ai;
    this.jobs = options.jobs ?? null;
    this.logger = options.logger;
    this.config = options.config;
    this.onAnalyzed = options.onAnalyzed;
    this.onUploaded = options.onUploaded;
  }

  registerJobs(): void {
    const handle = async (payload: Record<string, unknown>) => {
      const job = parseWithSchema(documentAnalyzeJobPayloadSchema, payload, {
        source: 'job',
        message: 'Invalid document analysis job payload',
      });
      await this.processDocument(job.documentId, job.userId, {
        fields: job.fields,
      });
    };
    this.jobs?.process(DOCUMENT_PROCESS_JOB, handle);
    this.jobs?.process(DOCUMENT_ANALYZE_JOB, handle);
  }

  async analyze(input: AnalyzeDocumentInput): Promise<DocumentAnalysisResult> {
    this.requireAi();
    const file = validateDocumentFile(input.file, { maxBytes: this.config.documents.maxBytes });
    const fields = resolveDocumentFields(input.documentType, input.fields);
    const documentId = randomUUID();
    const storageKey = `documents/${input.userId}/${documentId}/${file.storedFilename}`;

    await this.storage.put({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimeType,
    });

    const document = await this.documents
      .create({
        id: documentId,
        userId: input.userId,
        originalFilename: file.originalFilename,
        storedFilename: file.storedFilename,
        storageKey,
        mimeType: file.mimeType,
        extension: file.extension,
        sizeBytes: file.size,
        checksumSha256: file.checksumSha256,
        documentType: input.documentType,
        requestedFields: fields,
        status: 'uploaded',
      })
      .catch(async (error: unknown) => {
        await this.storage.delete(storageKey).catch(() => undefined);
        throw error;
      });

    await this.onUploaded?.({
      documentId: document.id,
      userId: input.userId,
      documentType: input.documentType,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      sizeBytes: file.size,
    });

    const shouldAsync = Boolean(input.async) || file.size >= this.config.documents.asyncThresholdBytes;
    if (shouldAsync && this.jobs) {
      await this.jobs.enqueue(
        DOCUMENT_PROCESS_JOB,
        { documentId: document.id, userId: input.userId, fields } satisfies DocumentAnalyzeJobPayload,
        {
          attempts: DOCUMENT.JOB_ATTEMPTS,
          backoffMs: DOCUMENT.JOB_BACKOFF_MS,
          timeoutMs: JOBS.DEFAULT_TIMEOUT_MS,
          jobId: `${DOCUMENT_PROCESS_JOB}:${document.id}`,
        },
      );
      this.logger.info(
        { documentId: document.id, documentType: input.documentType, size: file.size, requestId: getRequestId() },
        'Document analysis queued',
      );
      return {
        id: document.id,
        status: 'processing',
        documentType: input.documentType,
        fields: {},
        missingFields: fields,
        confidence: 0,
        warnings: ['Document analysis is running in the background'],
        requiresReview: true,
      };
    }

    return this.processDocument(document.id, input.userId, { file, fields });
  }

  async getResult(documentId: string, userId: string): Promise<DocumentAnalysisResult> {
    const document = await this.documents.findByIdForUser(documentId, userId);
    return toAnalysisResult(document);
  }

  async processDocument(
    documentId: string,
    userId: string,
    prepared?: { file?: ValidatedDocumentFile; fields?: string[] },
  ): Promise<DocumentAnalysisResult> {
    const document = await this.documents.findByIdForUser(documentId, userId);
    if (document.status === 'completed' || document.status === 'needs_review') {
      return toAnalysisResult(document);
    }

    const claimed = await this.documents.claimForProcessing(documentId, userId);
    if (!claimed) {
      const current = await this.documents.findByIdForUser(documentId, userId);
      return toAnalysisResult(current);
    }

    const ai = this.requireAi();
    const storedFields = asStringArray(claimed.requestedFields);
    const fields =
      prepared?.fields && prepared.fields.length > 0
        ? prepared.fields
        : storedFields.length > 0
          ? storedFields
          : resolveDocumentFields(claimed.documentType);

    try {
      const buffer = prepared?.file?.buffer ?? (await this.storage.get(claimed.storageKey));
      const file = prepared?.file ?? {
        originalFilename: claimed.originalFilename,
        storedFilename: claimed.storedFilename,
        extension: claimed.extension as ValidatedDocumentFile['extension'],
        mimeType: claimed.mimeType,
        size: claimed.sizeBytes,
        buffer,
        checksumSha256: claimed.checksumSha256,
      };
      const extracted = extractDocumentText(file, this.config.documents.maxTextChars);
      await this.documents.updateStatus(claimed.id, 'processing', {
        extractedTextLength: extracted.text.length,
      });

      const content = `Document type: ${claimed.documentType}\nRequested fields: ${fields.join(', ')}\n\n${wrapUntrustedData('document', extracted.text)}`;
      const attachments = extracted.multimodal
        ? [{ mimeType: file.mimeType, data: file.buffer, filename: file.originalFilename }]
        : undefined;

      const result = await ai.extract({
        content,
        fields,
        attachments,
      });
      const reviewed = applyDocumentReview(result.data, {
        requestedFields: fields,
        threshold: this.config.documents.confidenceThreshold,
      });
      const warnings = extracted.truncated
        ? [...reviewed.warnings, 'Extracted text was truncated to the configured content limit']
        : reviewed.warnings;
      const status: DocumentStatusName = reviewed.requiresReview ? 'needs_review' : 'completed';

      await this.documents.saveExtraction({
        documentId: claimed.id,
        fields: reviewed.fields,
        missingFields: reviewed.missingFields,
        confidence: reviewed.confidence,
        warnings,
        requiresReview: reviewed.requiresReview,
        model: result.model,
        provider: result.provider,
        promptId: EXTRACT_PROMPT.id,
        promptVersion: EXTRACT_PROMPT.version,
      });
      await this.documents.updateStatus(claimed.id, status, { errorMessage: null });

      const output: DocumentAnalysisResult = {
        id: claimed.id,
        status,
        documentType: claimed.documentType,
        fields: reviewed.fields,
        missingFields: reviewed.missingFields,
        confidence: reviewed.confidence,
        warnings,
        requiresReview: reviewed.requiresReview,
      };

      await this.onAnalyzed?.({
        documentId: claimed.id,
        userId,
        documentType: claimed.documentType,
        status,
        requiresReview: reviewed.requiresReview,
        confidence: reviewed.confidence,
      });

      this.logger.info(
        {
          documentId: claimed.id,
          documentType: claimed.documentType,
          status,
          confidence: reviewed.confidence,
          requiresReview: reviewed.requiresReview,
          requestId: getRequestId(),
        },
        'Document analysis completed',
      );

      return output;
    } catch (error) {
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : 'Document analysis failed');
      await this.documents.updateStatus(claimed.id, 'failed', { errorMessage: message.slice(0, 500) });
      throw error;
    }
  }

  private requireAi(): AIService {
    if (!this.ai?.ready) {
      throw new ExternalServiceError('AI is not configured', { provider: 'ai' });
    }

    return this.ai;
  }
}

function toAnalysisResult(document: {
  id: string;
  status: DocumentStatusName;
  documentType: DocumentTypeName;
  errorMessage: string | null;
  extraction: {
    fields: unknown;
    missingFields: unknown;
    confidence: number;
    warnings: unknown;
    requiresReview: boolean;
  } | null;
}): DocumentAnalysisResult {
  const extraction = document.extraction;
  if (!extraction) {
    return {
      id: document.id,
      status: document.status,
      documentType: document.documentType,
      fields: {},
      missingFields: [],
      confidence: 0,
      warnings: document.errorMessage
        ? [document.errorMessage]
        : document.status === 'processing'
          ? ['Document analysis is running in the background']
          : [],
      requiresReview: document.status !== 'completed',
    };
  }

  return {
    id: document.id,
    status: document.status,
    documentType: document.documentType,
    fields: asRecord(extraction.fields),
    missingFields: asStringArray(extraction.missingFields),
    confidence: extraction.confidence,
    warnings: asStringArray(extraction.warnings),
    requiresReview: extraction.requiresReview,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

export function createDocumentIntelligenceService(
  options: DocumentIntelligenceOptions,
): DocumentIntelligenceService {
  const service = new DocumentIntelligenceService(options);
  service.registerJobs();
  return service;
}
