import type { Request, Response } from 'express';

import { AuthenticationError, AuthorizationError, ExternalServiceError, ValidationError } from '../errors';
import {
  contentTypeFromKey,
  verifySignedDownload,
  type StorageService,
  type StoredFileRecord,
} from '../integrations/storage';
import {
  storageDownloadQuerySchema,
  storageFileIdParamsSchema,
  storageSignedUrlBodySchema,
  storageUploadBodySchema,
} from '../integrations/storage/storage.schemas';
import { parseBody, parseParams, parseQuery } from '../schemas/parse';
import { PERMISSIONS } from '../rbac/catalog';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class StorageController {
  constructor(
    private readonly storage: StorageService | null,
    private readonly signingSecret: string,
  ) {}

  upload = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const file = req.file;
    if (!file) {
      throw new ValidationError('Invalid uploaded file', [
        { path: 'file', message: 'A file is required', code: 'custom' },
      ]);
    }

    const body = parseBody(storageUploadBodySchema, req.body);
    const stored = await this.requireStorage().upload({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
      fieldname: file.fieldname,
      uploadedBy: user.id,
      purpose: body.purpose,
    });
    const download = await this.requireStorage().getSignedUrl(stored.id, undefined, toActor(user));
    return sendSuccess(res, { ...toPublicFile(stored), download: toPublicDownload(download) }, 201);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(storageFileIdParamsSchema, req.params);
    const file = await this.requireStorage().getFile(params.id, toActor(user));
    return sendSuccess(res, toPublicFile(file));
  });

  downloadContent = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(storageFileIdParamsSchema, req.params);
    const file = await this.requireStorage().getFile(params.id, toActor(user));
    const body = await this.requireStorage().download(file.id, toActor(user));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', contentDisposition(file.originalName));
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(body);
  });

  signedUrl = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(storageFileIdParamsSchema, req.params);
    const body = parseBody(storageSignedUrlBodySchema, req.body ?? {});
    const download = await this.requireStorage().getSignedUrl(
      params.id,
      body.expiresInSeconds,
      toActor(user),
    );
    return sendSuccess(res, toPublicDownload(download));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(storageFileIdParamsSchema, req.params);
    await this.requireStorage().deleteFile(params.id, toActor(user));
    return sendSuccess(res, { deleted: true });
  });

  download = asyncHandler(async (req: Request, res: Response) => {
    const query = parseQuery(storageDownloadQuerySchema, req.query);
    const claims = verifySignedDownload({
      key: query.key,
      expires: query.expires,
      signature: query.sig,
      secret: this.signingSecret,
      subject: query.uid,
    });
    if (claims.subject) {
      const user = requireUser(req);
      if (user.id !== claims.subject && !user.permissions.includes(PERMISSIONS.ADMIN_SETTINGS)) {
        throw new AuthorizationError('You cannot access this file');
      }
    }
    const body = await this.requireStorage().get(claims.key);
    const filename = claims.key.split('/').pop() ?? 'download';
    res.setHeader('Content-Type', contentTypeFromKey(claims.key));
    res.setHeader('Content-Disposition', contentDisposition(filename));
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).send(body);
  });

  private requireStorage(): StorageService {
    if (!this.storage) {
      throw new ExternalServiceError('Storage is not configured', { provider: 'storage' });
    }

    return this.storage;
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}

function toActor(user: { id: string; permissions: string[] }) {
  return { id: user.id, permissions: user.permissions };
}

function toPublicFile(file: StoredFileRecord) {
  return {
    id: file.id,
    originalName: file.originalName,
    storedName: file.storedName,
    mimeType: file.mimeType,
    size: file.size,
    provider: file.provider,
    purpose: file.purpose,
    uploadedBy: file.uploadedBy,
    createdAt: file.createdAt.toISOString(),
  };
}

function toPublicDownload(download: { url: string; expiresAt: string }) {
  return {
    url: download.url,
    expiresAt: download.expiresAt,
  };
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"`;
}
