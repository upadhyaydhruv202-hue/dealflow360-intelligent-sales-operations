import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../../config';
import { ExternalServiceError, NotFoundError, ValidationError, AuthenticationError } from '../../errors';
import { LocalStorageProvider } from './providers/local.provider';
import { MemoryObjectStore, PostgresStorageProvider } from './providers/postgres.provider';
import { S3StorageProvider, type S3ClientLike } from './providers/s3.provider';
import { SharedStorageProvider } from './providers/shared.provider';
import { MemoryFileStore } from './storage.memory';
import { createStorageService, StorageService } from './storage.service';
import { createSignedDownload, DEV_STORAGE_SIGNING_SECRET, verifySignedDownload } from './storage.sign';
import type { StorageProvider, StoragePutInput, StoredObject } from './storage.types';

describe('LocalStorageProvider', () => {
  let root = '';

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('stores, reads, and deletes objects', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-storage-'));
    const storage = new StorageService(new LocalStorageProvider(root));
    const body = Buffer.from('hello');

    const stored = await storage.put({
      key: 'documents/user/file.txt',
      body,
      contentType: 'text/plain',
    });
    expect(stored.size).toBe(5);
    expect(await storage.get('documents/user/file.txt')).toEqual(body);

    await storage.delete('documents/user/file.txt');
    await expect(storage.get('documents/user/file.txt')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects path traversal keys', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-storage-'));
    const storage = new StorageService(new LocalStorageProvider(root));
    await expect(
      storage.put({ key: '../secret.txt', body: Buffer.from('x'), contentType: 'text/plain' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('reads from the remote store when the local cache misses', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-storage-'));
    const remote = new MemoryObjectStore();
    await remote.put({
      key: 'documents/shared.txt',
      body: Buffer.from('from-db'),
      contentType: 'text/plain',
      sizeBytes: 7,
    });
    const storage = new StorageService(
      new SharedStorageProvider(
        new LocalStorageProvider(root),
        new PostgresStorageProvider(remote),
      ),
    );
    expect(await storage.get('documents/shared.txt')).toEqual(Buffer.from('from-db'));
  });
});

describe('S3StorageProvider', () => {
  it('throws when S3 is selected without credentials', async () => {
    const config = loadConfig({ NODE_ENV: 'test', STORAGE_PROVIDER: 's3' });
    const storage = createStorageService(config);
    await expect(
      storage.put({ key: 'documents/a.txt', body: Buffer.from('x'), contentType: 'text/plain' }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('puts, gets, and deletes through an injected client', async () => {
    const objects = new Map<string, Buffer>();
    const client: S3ClientLike = {
      async send(command) {
        if (command instanceof PutObjectCommand) {
          const key = command.input.Key as string;
          objects.set(key, Buffer.from(command.input.Body as Buffer));
          return {};
        }

        if (command instanceof GetObjectCommand) {
          const key = command.input.Key as string;
          const body = objects.get(key);
          if (!body) {
            const error = new Error('missing') as Error & { name: string };
            error.name = 'NoSuchKey';
            throw error;
          }

          return {
            Body: {
              transformToByteArray: async () => body,
            },
          };
        }

        if (command instanceof DeleteObjectCommand) {
          objects.delete(command.input.Key as string);
          return {};
        }

        throw new Error('unexpected command');
      },
    };

    const provider = new S3StorageProvider(
      {
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
        bucket: 'hackathon',
      },
      client,
    );

    await provider.put({
      key: 'documents/a.txt',
      body: Buffer.from('invoice'),
      contentType: 'text/plain',
    });
    expect(await provider.get('documents/a.txt')).toEqual(Buffer.from('invoice'));
    await provider.delete('documents/a.txt');
    await expect(provider.get('documents/a.txt')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('issues a signed download URL through an injected signer', async () => {
    const provider = new S3StorageProvider(
      {
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
        bucket: 'hackathon',
      },
      { send: async () => ({}) },
      async (key) => `https://s3.example/${key}?signed=1`,
    );

    const signed = await provider.signDownload('documents/a.txt', 60);
    expect(signed.url).toBe('https://s3.example/documents/a.txt?signed=1');
  });

  it('still serves HMAC download keys from S3 after a local-to-S3 migration', async () => {
    const objects = new Map<string, Buffer>();
    const client: S3ClientLike = {
      async send(command) {
        if (command instanceof PutObjectCommand) {
          objects.set(command.input.Key as string, Buffer.from(command.input.Body as Buffer));
          return {};
        }

        if (command instanceof GetObjectCommand) {
          const body = objects.get(command.input.Key as string);
          if (!body) {
            const error = new Error('missing') as Error & { name: string };
            error.name = 'NoSuchKey';
            throw error;
          }

          return { Body: { transformToByteArray: async () => body } };
        }

        throw new Error('unexpected command');
      },
    };
    const provider = new S3StorageProvider(
      {
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
        bucket: 'hackathon',
      },
      client,
    );
    await provider.put({
      key: 'files/attachments/system/a.txt',
      body: Buffer.from('migrated'),
      contentType: 'text/plain',
    });

    const hmac = createSignedDownload('files/attachments/system/a.txt', 60, {
      appUrl: 'http://localhost:5000',
      secret: 'unit-test-secret',
    });
    const url = new URL(hmac.url);
    const claims = verifySignedDownload({
      key: url.searchParams.get('key') ?? '',
      expires: url.searchParams.get('expires') ?? '',
      signature: url.searchParams.get('sig') ?? '',
      secret: 'unit-test-secret',
    });
    expect(await provider.get(claims.key)).toEqual(Buffer.from('migrated'));
  });
});

class FailingProvider implements StorageProvider {
  readonly name = 'failing';

  async put(_input: StoragePutInput): Promise<StoredObject> {
    throw new ExternalServiceError('Storage provider failed', { provider: 'failing' });
  }

  async get(_key: string): Promise<Buffer> {
    throw new ExternalServiceError('Storage provider failed', { provider: 'failing' });
  }

  async delete(_key: string): Promise<void> {
    throw new ExternalServiceError('Storage provider failed', { provider: 'failing' });
  }
}

describe('StorageService file API', () => {
  let root = '';

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function createService() {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-files-'));
    return new StorageService(new LocalStorageProvider(root), {
      signing: { appUrl: 'http://localhost:5000', secret: 'unit-test-secret' },
      files: new MemoryFileStore(),
      configuredProvider: 'local',
      signedUrlExpiresSeconds: 120,
    });
  }

  it('uploads, downloads, signs, and deletes a validated file', async () => {
    const storage = await createService();
    const uploaded = await storage.upload({
      originalname: 'notes.txt',
      mimetype: 'application/x-msdownload',
      size: 5,
      buffer: Buffer.from('hello'),
      uploadedBy: '11111111-1111-4111-8111-111111111111',
      purpose: 'attachment',
    });

    expect(uploaded.originalName).toBe('notes.txt');
    expect(uploaded.mimeType).toBe('text/plain');
    expect(uploaded.provider).toBe('local');
    expect(uploaded.key).toContain('files/attachments/');
    expect(await storage.download(uploaded.id)).toEqual(Buffer.from('hello'));

    const signed = await storage.getSignedUrl(uploaded.id);
    expect(signed.url).toContain('/api/v1/storage/download');
    expect(signed.key).toBe(uploaded.key);

    await storage.delete(uploaded.id);
    await expect(storage.download(uploaded.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects invalid and oversized uploads', async () => {
    const storage = await createService();
    await expect(
      storage.upload({
        originalname: 'payload.exe',
        size: 4,
        buffer: Buffer.from('MZ\x90\x00'),
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const body = Buffer.alloc(32, 65);
    const tight = new StorageService(new LocalStorageProvider(root), {
      files: new MemoryFileStore(),
      maxBytes: 8,
    });
    await expect(
      tight.upload({ originalname: 'big.txt', size: body.length, buffer: body }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns not found for a missing file', async () => {
    const storage = await createService();
    await expect(storage.getFile('11111111-1111-4111-8111-111111111111')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(storage.download('11111111-1111-4111-8111-111111111111')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(storage.getSignedUrl('11111111-1111-4111-8111-111111111111')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('surfaces provider failures', async () => {
    const storage = new StorageService(new FailingProvider(), { files: new MemoryFileStore() });
    await expect(
      storage.upload({ originalname: 'notes.txt', size: 4, buffer: Buffer.from('data') }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('keeps upload metadata in process when no database is configured', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-files-nodb-'));
    const storage = createStorageService(
      loadConfig({
        NODE_ENV: 'test',
        STORAGE_PROVIDER: 'local',
        STORAGE_LOCAL_DIR: root,
        JWT_ACCESS_SECRET: 'test-access-secret-not-for-production-32',
      }),
    );
    const uploaded = await storage.upload({
      originalname: 'notes.txt',
      size: 4,
      buffer: Buffer.from('data'),
      uploadedBy: '11111111-1111-4111-8111-111111111111',
    });
    expect(await storage.getFile(uploaded.id)).toMatchObject({ id: uploaded.id, size: 4 });
    const signed = await storage.getSignedUrl(uploaded.id);
    expect(signed.key).toBe(uploaded.key);
    const url = new URL(signed.url);
    expect(() =>
      verifySignedDownload({
        key: url.searchParams.get('key') ?? '',
        expires: url.searchParams.get('expires') ?? '',
        signature: url.searchParams.get('sig') ?? '',
        secret: 'test-access-secret-not-for-production-32',
      }),
    ).toThrow(AuthenticationError);
    expect(
      verifySignedDownload({
        key: url.searchParams.get('key') ?? '',
        expires: url.searchParams.get('expires') ?? '',
        signature: url.searchParams.get('sig') ?? '',
        secret: DEV_STORAGE_SIGNING_SECRET,
      }),
    ).toEqual({ key: uploaded.key });
    expect(await storage.download(uploaded.id)).toEqual(Buffer.from('data'));
  });

  it('removes metadata even if the object bytes are already gone', async () => {
    const storage = await createService();
    const uploaded = await storage.upload({
      originalname: 'notes.txt',
      size: 4,
      buffer: Buffer.from('gone'),
      uploadedBy: '11111111-1111-4111-8111-111111111111',
    });
    await storage.delete(uploaded.key);
    await storage.deleteFile(uploaded.id);
    await expect(storage.getFile(uploaded.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
