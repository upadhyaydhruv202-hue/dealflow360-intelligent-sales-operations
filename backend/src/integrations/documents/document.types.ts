import { JOB_NAMES } from '../../constants';

export const DOCUMENT_TYPES = [
  'invoice',
  'receipt',
  'certificate',
  'application',
  'form',
  'contract',
  'report',
  'generic',
] as const;

export type DocumentTypeName = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  'uploaded',
  'processing',
  'completed',
  'failed',
  'needs_review',
] as const;

export type DocumentStatusName = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_MIME_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
} as const;

export const DOCUMENT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'txt'] as const;

export type DocumentExtension = (typeof DOCUMENT_EXTENSIONS)[number];

export const DOCUMENT_ALLOWED_MIME_TYPES = [
  DOCUMENT_MIME_TYPES.pdf,
  DOCUMENT_MIME_TYPES.png,
  DOCUMENT_MIME_TYPES.jpg,
  DOCUMENT_MIME_TYPES.txt,
] as const;

export const DOCUMENT_TYPE_FIELDS: Record<DocumentTypeName, readonly string[]> = {
  invoice: ['invoiceNumber', 'invoiceDate', 'vendor', 'customer', 'total', 'currency', 'dueDate', 'tax'],
  receipt: ['merchant', 'date', 'total', 'currency', 'paymentMethod', 'items'],
  certificate: ['title', 'holderName', 'issuer', 'issueDate', 'expiryDate', 'identifier'],
  application: ['applicantName', 'applicationType', 'reference', 'date', 'status'],
  form: ['formName', 'submitter', 'date', 'reference'],
  contract: ['title', 'partyA', 'partyB', 'effectiveDate', 'expiryDate', 'value'],
  report: ['title', 'author', 'date', 'summary'],
  generic: ['title', 'date', 'reference', 'amount'],
};

export interface UploadedDocumentInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  fieldname?: string;
}

export interface ValidatedDocumentFile {
  originalFilename: string;
  storedFilename: string;
  extension: DocumentExtension;
  mimeType: string;
  size: number;
  buffer: Buffer;
  checksumSha256: string;
}

export interface DocumentAnalysisResult {
  id: string;
  status: DocumentStatusName;
  documentType: DocumentTypeName;
  fields: Record<string, unknown>;
  missingFields: string[];
  confidence: number;
  warnings: string[];
  requiresReview: boolean;
}

export const DOCUMENT_ANALYZE_JOB = JOB_NAMES.DOCUMENT_ANALYZE;
export const DOCUMENT_PROCESS_JOB = JOB_NAMES.DOCUMENT_PROCESS;

export interface DocumentAnalyzeJobPayload {
  documentId: string;
  userId: string;
  fields?: string[];
  requestId?: string;
}
