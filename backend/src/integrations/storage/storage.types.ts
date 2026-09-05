import type { StoragePurposeName } from '../../constants';

export type StoragePurpose = StoragePurposeName;

export type StorageExtension = 'pdf' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'txt' | 'csv' | 'json';

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
}

export interface StoragePutInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface SignedDownload {
  key: string;
  url: string;
  expiresAt: string;
}

export interface StorageProvider {
  readonly name: string;
  put(input: StoragePutInput): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  signDownload?(key: string, expiresInSeconds: number): Promise<SignedDownload>;
}

export interface UploadedFileInput {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
  fieldname?: string;
}

export interface ValidatedUpload {
  originalName: string;
  storedName: string;
  extension: StorageExtension;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface StorageUploadInput extends UploadedFileInput {
  uploadedBy?: string | null;
  purpose?: StoragePurpose;
}

export interface StoredFileRecord {
  id: string;
  originalName: string;
  storedName: string;
  key: string;
  mimeType: string;
  size: number;
  provider: string;
  purpose: StoragePurpose;
  uploadedBy: string | null;
  createdAt: Date;
}

export interface CreateStoredFileInput {
  id: string;
  originalName: string;
  storedName: string;
  key: string;
  mimeType: string;
  size: number;
  provider: string;
  purpose: StoragePurpose;
  uploadedBy?: string | null;
}

export interface FileStore {
  create(input: CreateStoredFileInput): Promise<StoredFileRecord>;
  findById(id: string): Promise<StoredFileRecord | null>;
  deleteById(id: string): Promise<void>;
}

export interface StorageActor {
  id: string;
  permissions: readonly string[];
}

export const STORAGE_MIME_TYPES: Record<StorageExtension, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
};

export const STORAGE_EXTENSIONS: readonly StorageExtension[] = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'txt',
  'csv',
  'json',
];

export const STORAGE_PURPOSE_PREFIX: Record<StoragePurpose, string> = {
  attachment: 'files/attachments',
  avatar: 'files/avatars',
  export: 'files/exports',
  document: 'files/documents',
  report: 'files/reports',
};

export const STORAGE_PURPOSE_EXTENSIONS: Record<StoragePurpose, readonly StorageExtension[]> = {
  attachment: STORAGE_EXTENSIONS,
  avatar: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
  export: ['pdf', 'csv', 'json', 'txt'],
  document: ['pdf', 'png', 'jpg', 'jpeg', 'txt'],
  report: ['pdf'],
};
