import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import { AUDIT_ACTIONS, STORAGE } from '../../constants';
import { AuthorizationError, ExternalServiceError, NotFoundError } from '../../errors';
import type { AuditService } from '../../audit/audit.service';
import { PERMISSIONS } from '../../rbac/catalog';
import { FileRepository } from '../../repositories/file.repository';
import type { AppConfig } from '../../types/config';
import { LocalStorageProvider } from './providers/local.provider';
import { PostgresStorageProvider } from './providers/postgres.provider';
import { PrismaObjectStore } from './providers/prisma-object-store';
import { S3StorageProvider } from './providers/s3.provider';
import { SharedStorageProvider } from './providers/shared.provider';
import { MemoryFileStore } from './storage.memory';
import {
  DEV_STORAGE_SIGNING_SECRET,
  STORAGE_DOWNLOAD_DEFAULT_SECONDS,
  createSignedDownload,
  type StorageSigning,
} from './storage.sign';
import { assertStorageKey, resolveLocalStorageDir } from './storage.keys';
import {
  STORAGE_PURPOSE_PREFIX,
  type FileStore,
  type SignedDownload,
  type StorageActor,
  type StorageProvider,
  type StoragePutInput,
  type StoragePurpose,
  type StorageUploadInput,
  type StoredFileRecord,
  type StoredObject,
} from './storage.types';
import { validateUploadedFile } from './storage.validate';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StorageServiceOptions {
  signing?: StorageSigning;
  files?: FileStore | null;
  maxBytes?: number;
  signedUrlExpiresSeconds?: number;
  configuredProvider?: string;
  audit?: AuditService | null;
}

export class StorageService implements StorageProvider {
  readonly name: string;
  private readonly provider: StorageProvider;
  private readonly signing?: StorageSigning;
  private readonly files?: FileStore | null;
  private readonly maxBytes: number;
  private readonly signedUrlExpiresSeconds: number;
  private readonly configuredProvider: string;
  private readonly audit: AuditService | null;

  constructor(provider: StorageProvider, signingOrOptions?: StorageSigning | StorageServiceOptions) {
    const options = normalizeOptions(signingOrOptions);
    this.provider = provider;
    this.name = provider.name;
    this.signing = options.signing;
    this.files = options.files;
    this.maxBytes = options.maxBytes ?? STORAGE.MAX_BYTES;
    this.signedUrlExpiresSeconds = options.signedUrlExpiresSeconds ?? STORAGE_DOWNLOAD_DEFAULT_SECONDS;
    this.configuredProvider = options.configuredProvider ?? provider.name;
    this.audit = options.audit ?? null;
  }

  put(input: StoragePutInput): Promise<StoredObject> {
    return this.provider.put(input);
  }

  get(key: string): Promise<Buffer> {
    return this.provider.get(key);
  }

  async delete(idOrKey: string): Promise<void> {
    const record = await this.lookupFile(idOrKey);
    if (!record) {
      return this.provider.delete(idOrKey);
    }

    await this.removeObject(record.key);
    await this.files?.deleteById(record.id);
  }

  async signDownload(
    key: string,
    expiresInSeconds = this.signedUrlExpiresSeconds,
    actor?: StorageActor,
  ): Promise<SignedDownload> {
    const safeKey = assertStorageKey(key);
    if (this.provider.signDownload && !actor) {
      return this.provider.signDownload(safeKey, expiresInSeconds);
    }

    if (!this.signing?.secret) {
      throw new ExternalServiceError('Storage signing secret is not configured', { provider: 'storage' });
    }

    return createSignedDownload(safeKey, expiresInSeconds, this.signing, {
      subject: actor?.id,
    });
  }

  async upload(input: StorageUploadInput): Promise<StoredFileRecord> {
    const purpose: StoragePurpose = input.purpose ?? 'attachment';
    const validated = validateUploadedFile(input, { maxBytes: this.maxBytes, purpose });
    const id = randomUUID();
    const owner = input.uploadedBy?.trim() || 'system';
    const key = assertStorageKey(
      `${STORAGE_PURPOSE_PREFIX[purpose]}/${owner}/${id}/${validated.storedName}`,
    );

    await this.provider.put({
      key,
      body: validated.buffer,
      contentType: validated.mimeType,
    });

    const record: CreatePayload = {
      id,
      originalName: validated.originalName,
      storedName: validated.storedName,
      key,
      mimeType: validated.mimeType,
      size: validated.size,
      provider: this.configuredProvider,
      purpose,
      uploadedBy: input.uploadedBy ?? null,
    };

    try {
      const stored =
        this.files != null ? await this.files.create(record) : { ...record, createdAt: new Date() };
      await this.audit?.record({
        actorId: input.uploadedBy ?? undefined,
        action: AUDIT_ACTIONS.FILE_UPLOADED,
        resource: 'file',
        resourceId: stored.id,
        metadata: {
          purpose: stored.purpose,
          mimeType: stored.mimeType,
          size: stored.size,
          originalName: stored.originalName,
        },
        status: 'succeeded',
      });
      return stored;
    } catch (error) {
      await this.provider.delete(key).catch(() => undefined);
      throw error;
    }
  }

  async download(idOrKey: string, actor?: StorageActor): Promise<Buffer> {
    const record = await this.requireFile(idOrKey, actor);
    if (record) {
      return this.provider.get(record.key);
    }

    return this.provider.get(idOrKey);
  }

  async getSignedUrl(
    idOrKey: string,
    expiresInSeconds = this.signedUrlExpiresSeconds,
    actor?: StorageActor,
  ): Promise<SignedDownload> {
    const record = await this.requireFile(idOrKey, actor);
    return this.signDownload(record?.key ?? idOrKey, expiresInSeconds, actor);
  }

  async getFile(id: string, actor?: StorageActor): Promise<StoredFileRecord> {
    const record = await this.requirePersistedFile(id, actor);
    return record;
  }

  async deleteFile(id: string, actor?: StorageActor): Promise<void> {
    const record = await this.requirePersistedFile(id, actor);
    await this.removeObject(record.key);
    await this.files?.deleteById(record.id);
    await this.audit?.record({
      actorId: actor?.id,
      action: AUDIT_ACTIONS.FILE_DELETED,
      resource: 'file',
      resourceId: record.id,
      metadata: { purpose: record.purpose, mimeType: record.mimeType },
      status: 'succeeded',
    });
  }

  private async lookupFile(idOrKey: string): Promise<StoredFileRecord | null> {
    if (!this.files || !UUID_PATTERN.test(idOrKey)) {
      return null;
    }

    return this.files.findById(idOrKey);
  }

  private async requireFile(
    idOrKey: string,
    actor?: StorageActor,
  ): Promise<StoredFileRecord | null> {
    const record = await this.lookupFile(idOrKey);
    if (!record) {
      if (UUID_PATTERN.test(idOrKey) && this.files) {
        throw new NotFoundError('Stored file was not found');
      }

      return null;
    }

    assertFileAccess(record, actor);
    return record;
  }

  private async requirePersistedFile(id: string, actor?: StorageActor): Promise<StoredFileRecord> {
    if (!this.files) {
      throw new NotFoundError('Stored file was not found');
    }

    const record = await this.files.findById(id);
    if (!record) {
      throw new NotFoundError('Stored file was not found');
    }

    assertFileAccess(record, actor);
    return record;
  }

  private async removeObject(key: string): Promise<void> {
    try {
      await this.provider.delete(key);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return;
      }

      throw error;
    }
  }
}

type CreatePayload = Omit<StoredFileRecord, 'createdAt'>;

export function createStorageService(
  config: Pick<AppConfig, 'storage'> & Partial<Pick<AppConfig, 'app' | 'isProduction'>>,
  options: { prisma?: PrismaClient | null; files?: FileStore | null; audit?: AuditService | null } = {},
): StorageService {
  const signing = resolveStorageSigning(config);
  const provider = createProvider(config, options.prisma ?? null);
  const files = options.files === undefined
    ? options.prisma
      ? new FileRepository(options.prisma)
      : new MemoryFileStore()
    : options.files;

  return new StorageService(provider, {
    signing,
    files,
    maxBytes: config.storage.maxBytes ?? STORAGE.MAX_BYTES,
    signedUrlExpiresSeconds: config.storage.signedUrlExpiresSeconds ?? STORAGE_DOWNLOAD_DEFAULT_SECONDS,
    configuredProvider: config.storage.provider,
    audit: options.audit,
  });
}

function createProvider(
  config: Pick<AppConfig, 'storage'>,
  prisma: PrismaClient | null,
): StorageProvider {
  if (config.storage.provider === 's3') {
    return new S3StorageProvider(config.storage.aws);
  }

  if (config.storage.provider === 'postgres') {
    if (!prisma) {
      throw new Error('STORAGE_PROVIDER=postgres requires a database connection');
    }

    return new PostgresStorageProvider(new PrismaObjectStore(prisma));
  }

  const local = new LocalStorageProvider(resolveLocalStorageDir(config.storage.localDir));
  if (!prisma) {
    return local;
  }

  return new SharedStorageProvider(local, new PostgresStorageProvider(new PrismaObjectStore(prisma)));
}

export function resolveStorageSigning(
  config: Partial<Pick<AppConfig, 'app' | 'isProduction' | 'storage'>>,
): StorageSigning | undefined {
  const secret =
    config.storage?.signingSecret ?? (config.isProduction ? undefined : DEV_STORAGE_SIGNING_SECRET);
  if (!secret) {
    return undefined;
  }

  return {
    appUrl: config.app?.url ?? 'http://localhost:5000',
    secret,
  };
}

function normalizeOptions(
  signingOrOptions?: StorageSigning | StorageServiceOptions,
): StorageServiceOptions {
  if (!signingOrOptions) {
    return {};
  }

  if (isLegacySigning(signingOrOptions)) {
    return { signing: signingOrOptions };
  }

  return signingOrOptions;
}

function isLegacySigning(value: StorageSigning | StorageServiceOptions): value is StorageSigning {
  return (
    'secret' in value &&
    'appUrl' in value &&
    !('signing' in value) &&
    !('files' in value) &&
    !('maxBytes' in value) &&
    !('signedUrlExpiresSeconds' in value) &&
    !('configuredProvider' in value)
  );
}

function assertFileAccess(file: StoredFileRecord, actor?: StorageActor): void {
  if (!actor) {
    return;
  }

  if (file.uploadedBy === actor.id) {
    return;
  }

  if (actor.permissions.includes(PERMISSIONS.ADMIN_SETTINGS)) {
    return;
  }

  throw new AuthorizationError('You cannot access this file');
}
