import type { Document, DocumentExtraction, Prisma } from '@prisma/client';

import { NotFoundError } from '../errors';
import { mapPrismaError } from '../lib/prisma-error';
import type { DbClient } from './types';
import type { DocumentStatusName, DocumentTypeName } from '../integrations/documents/document.types';

export interface CreateDocumentInput {
  id?: string;
  userId: string;
  originalFilename: string;
  storedFilename: string;
  storageKey: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  checksumSha256: string;
  documentType: DocumentTypeName;
  requestedFields: string[];
  status?: DocumentStatusName;
}

export interface SaveExtractionInput {
  documentId: string;
  fields: Record<string, unknown>;
  missingFields: string[];
  confidence: number;
  warnings: string[];
  requiresReview: boolean;
  model?: string | null;
  provider?: string | null;
  promptId?: string | null;
  promptVersion?: string | null;
}

export type DocumentWithExtraction = Document & { extraction: DocumentExtraction | null };

export class DocumentRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateDocumentInput): Promise<Document> {
    try {
      return await this.db.document.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          userId: input.userId,
          originalFilename: input.originalFilename,
          storedFilename: input.storedFilename,
          storageKey: input.storageKey,
          mimeType: input.mimeType,
          extension: input.extension,
          sizeBytes: input.sizeBytes,
          checksumSha256: input.checksumSha256,
          documentType: input.documentType,
          requestedFields: input.requestedFields,
          status: input.status ?? 'uploaded',
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findById(id: string): Promise<DocumentWithExtraction | null> {
    try {
      return await this.db.document.findUnique({
        where: { id },
        include: { extraction: true },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<DocumentWithExtraction> {
    try {
      const document = await this.db.document.findFirst({
        where: { id, userId },
        include: { extraction: true },
      });
      if (!document) {
        throw new NotFoundError('Document not found');
      }
      return document;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async updateStorageKey(id: string, storageKey: string): Promise<Document> {
    try {
      return await this.db.document.update({
        where: { id },
        data: { storageKey },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async claimForProcessing(id: string, userId: string): Promise<DocumentWithExtraction | null> {
    try {
      const result = await this.db.document.updateMany({
        where: { id, userId, status: { in: ['uploaded', 'failed'] } },
        data: { status: 'processing', errorMessage: null },
      });
      if (result.count === 0) {
        return null;
      }
      return this.findByIdForUser(id, userId);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async updateStatus(
    id: string,
    status: DocumentStatusName,
    extra: { errorMessage?: string | null; extractedTextLength?: number | null } = {},
  ): Promise<Document> {
    try {
      return await this.db.document.update({
        where: { id },
        data: {
          status,
          errorMessage: extra.errorMessage === undefined ? undefined : extra.errorMessage,
          extractedTextLength:
            extra.extractedTextLength === undefined ? undefined : extra.extractedTextLength,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async saveExtraction(input: SaveExtractionInput): Promise<DocumentExtraction> {
    const data = {
      fields: input.fields as Prisma.InputJsonValue,
      missingFields: input.missingFields as Prisma.InputJsonValue,
      confidence: input.confidence,
      warnings: input.warnings as Prisma.InputJsonValue,
      requiresReview: input.requiresReview,
      model: input.model ?? null,
      provider: input.provider ?? null,
      promptId: input.promptId ?? null,
      promptVersion: input.promptVersion ?? null,
    };

    try {
      return await this.db.documentExtraction.upsert({
        where: { documentId: input.documentId },
        create: {
          documentId: input.documentId,
          ...data,
        },
        update: data,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
