import { randomUUID } from 'node:crypto';

import type { Document, DocumentExtraction, Prisma } from '@prisma/client';

import { NotFoundError } from '../../src/errors';
import type {
  CreateDocumentInput,
  DocumentWithExtraction,
  SaveExtractionInput,
} from '../../src/repositories/document.repository';
import type { DocumentStatusName } from '../../src/integrations/documents/document.types';

export class MemoryDocumentRepository {
  private readonly documents = new Map<string, Document>();
  private readonly extractions = new Map<string, DocumentExtraction>();

  async create(input: CreateDocumentInput): Promise<Document> {
    const now = new Date();
    const document: Document = {
      id: input.id ?? randomUUID(),
      userId: input.userId,
      originalFilename: input.originalFilename,
      storedFilename: input.storedFilename,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      extension: input.extension,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
      documentType: input.documentType,
      requestedFields: input.requestedFields as Prisma.JsonValue,
      status: input.status ?? 'uploaded',
      extractedTextLength: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(document.id, document);
    return document;
  }

  async findById(id: string): Promise<DocumentWithExtraction | null> {
    const document = this.documents.get(id);
    if (!document) {
      return null;
    }

    return { ...document, extraction: this.extractions.get(id) ?? null };
  }

  async findByIdForUser(id: string, userId: string): Promise<DocumentWithExtraction> {
    const document = await this.findById(id);
    if (!document || document.userId !== userId) {
      throw new NotFoundError('Document not found');
    }

    return document;
  }

  async claimForProcessing(id: string, userId: string): Promise<DocumentWithExtraction | null> {
    const document = this.documents.get(id);
    if (!document || document.userId !== userId) {
      return null;
    }
    if (document.status !== 'uploaded' && document.status !== 'failed') {
      return null;
    }

    await this.updateStatus(id, 'processing', { errorMessage: null });
    return this.findByIdForUser(id, userId);
  }

  async updateStorageKey(id: string, storageKey: string): Promise<Document> {
    const document = this.require(id);
    const updated = { ...document, storageKey, updatedAt: new Date() };
    this.documents.set(id, updated);
    return updated;
  }

  async updateStatus(
    id: string,
    status: DocumentStatusName,
    extra: { errorMessage?: string | null; extractedTextLength?: number | null } = {},
  ): Promise<Document> {
    const document = this.require(id);
    const updated = {
      ...document,
      status,
      errorMessage: extra.errorMessage === undefined ? document.errorMessage : extra.errorMessage,
      extractedTextLength:
        extra.extractedTextLength === undefined ? document.extractedTextLength : extra.extractedTextLength,
      updatedAt: new Date(),
    };
    this.documents.set(id, updated);
    return updated;
  }

  async saveExtraction(input: SaveExtractionInput): Promise<DocumentExtraction> {
    this.require(input.documentId);
    const now = new Date();
    const existing = this.extractions.get(input.documentId);
    const extraction: DocumentExtraction = {
      id: existing?.id ?? randomUUID(),
      documentId: input.documentId,
      fields: input.fields as Prisma.JsonValue,
      missingFields: input.missingFields as Prisma.JsonValue,
      confidence: input.confidence,
      warnings: input.warnings as Prisma.JsonValue,
      requiresReview: input.requiresReview,
      model: input.model ?? null,
      provider: input.provider ?? null,
      promptId: input.promptId ?? null,
      promptVersion: input.promptVersion ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.extractions.set(input.documentId, extraction);
    return extraction;
  }

  private require(id: string): Document {
    const document = this.documents.get(id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    return document;
  }
}
