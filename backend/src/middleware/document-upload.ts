import type { RequestHandler } from 'express';

import { DOCUMENT } from '../constants';
import { createFileUploadMiddleware } from './file-upload';

export function createDocumentUploadMiddleware(maxBytes = DOCUMENT.MAX_BYTES): RequestHandler {
  return createFileUploadMiddleware(maxBytes);
}
