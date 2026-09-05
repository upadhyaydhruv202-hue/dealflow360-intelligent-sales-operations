import { API_PATHS } from '@hackathon/api-contract';

import { apiGet, apiRequest } from './api';

export interface StoredFile {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  provider: string;
  purpose?: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface SignedDownload {
  url: string;
  expiresAt: string;
}

export function getFile(id: string, token: string) {
  return apiGet<StoredFile>(API_PATHS.files.byId(id), token);
}

export function createFileSignedUrl(id: string, token: string, expiresInSeconds?: number) {
  return apiRequest<SignedDownload>(API_PATHS.files.signedUrl(id), {
    method: 'POST',
    token,
    body: expiresInSeconds ? { expiresInSeconds } : {},
  });
}

export function deleteFile(id: string, token: string) {
  return apiRequest<{ deleted: true }>(API_PATHS.files.byId(id), {
    method: 'DELETE',
    token,
  });
}
