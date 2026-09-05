import { randomUUID } from 'node:crypto';

import type { Repositories } from '../../src/repositories';
import type { CreateDocumentInput } from '../../src/repositories/document.repository';
import { FACTORY_CHECKSUM_SHA256 } from './constants';
import { uniqueLabel } from './sequence';

export interface BuildDocumentInput extends Partial<CreateDocumentInput> {
  userId?: string;
}

export function buildDocument(overrides: BuildDocumentInput = {}): CreateDocumentInput {
  const n = uniqueLabel('');
  return {
    id: overrides.id,
    userId: overrides.userId ?? randomUUID(),
    originalFilename: overrides.originalFilename ?? `invoice-${n}.pdf`,
    storedFilename: overrides.storedFilename ?? `invoice-${n}.pdf`,
    storageKey: overrides.storageKey ?? `documents/${n}/invoice.pdf`,
    mimeType: overrides.mimeType ?? 'application/pdf',
    extension: overrides.extension ?? 'pdf',
    sizeBytes: overrides.sizeBytes ?? 1024,
    checksumSha256: overrides.checksumSha256 ?? FACTORY_CHECKSUM_SHA256,
    documentType: overrides.documentType ?? 'invoice',
    requestedFields: overrides.requestedFields ?? ['invoiceNumber', 'total'],
    status: overrides.status ?? 'uploaded',
  };
}

export async function createDocument(repos: Repositories, overrides: BuildDocumentInput) {
  if (!overrides.userId) {
    throw new Error('createDocument requires userId');
  }

  return repos.documents.create(buildDocument(overrides));
}
