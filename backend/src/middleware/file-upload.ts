import type { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';

import { STORAGE } from '../constants';
import { ValidationError } from '../errors';

export function createFileUploadMiddleware(maxBytes = STORAGE.MAX_BYTES): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxBytes,
      files: 1,
      fields: 16,
      fieldSize: 16 * 1024,
    },
  }).single('file');

  return (req, res, next) => {
    upload(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(
            new ValidationError('Uploaded file is too large', [
              { path: 'file.size', message: 'File exceeds the maximum allowed size', code: 'too_big' },
            ]),
          );
          return;
        }

        next(
          new ValidationError('Invalid uploaded file', [
            { path: 'file', message: 'The uploaded file could not be accepted', code: 'custom' },
          ]),
        );
        return;
      }

      next(error);
    });
  };
}
