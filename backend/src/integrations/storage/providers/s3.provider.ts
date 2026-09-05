import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { ExternalServiceError, NotFoundError } from '../../../errors';
import type { AppConfig } from '../../../types/config';
import { assertStorageKey } from '../storage.keys';
import type { SignedDownload, StorageProvider, StoragePutInput, StoredObject } from '../storage.types';

export type S3ClientLike = {
  send(command: unknown): Promise<{ Body?: unknown }>;
};

export type S3Signer = (key: string, expiresInSeconds: number) => Promise<string>;

export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private cachedClient?: S3ClientLike;

  constructor(
    private readonly aws: AppConfig['storage']['aws'],
    client?: S3ClientLike,
    private readonly signer?: S3Signer,
  ) {
    this.cachedClient = client;
  }

  async put(input: StoragePutInput): Promise<StoredObject> {
    const key = assertStorageKey(input.key);
    const client = this.getClient();

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.requireBucket(),
          Key: key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    } catch (error) {
      mapS3Error(error, 'put');
    }

    return {
      key,
      size: input.body.length,
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    const safeKey = assertStorageKey(key);
    const client = this.getClient();

    try {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: this.requireBucket(),
          Key: safeKey,
        }),
      );
      return await streamToBuffer(result.Body);
    } catch (error) {
      mapS3Error(error, 'get');
    }
  }

  async signDownload(key: string, expiresInSeconds: number): Promise<SignedDownload> {
    const safeKey = assertStorageKey(key);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    if (this.signer) {
      const url = await this.signer(safeKey, expiresInSeconds);
      return { key: safeKey, url, expiresAt };
    }

    const client = this.getClient();
    if (!(client instanceof S3Client)) {
      throw new ExternalServiceError('S3 signed downloads require a real S3 client', { provider: 's3' });
    }

    try {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: this.requireBucket(),
          Key: safeKey,
        }),
        { expiresIn: expiresInSeconds },
      );
      return { key: safeKey, url, expiresAt };
    } catch (error) {
      mapS3Error(error, 'signDownload');
    }
  }

  async delete(key: string): Promise<void> {
    const safeKey = assertStorageKey(key);
    const client = this.getClient();

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.requireBucket(),
          Key: safeKey,
        }),
      );
    } catch (error) {
      if (isS3NotFound(error)) {
        return;
      }

      mapS3Error(error, 'delete');
    }
  }

  private getClient(): S3ClientLike {
    if (this.cachedClient) {
      return this.cachedClient;
    }

    this.requireConfig();
    this.cachedClient = new S3Client({
      region: this.aws.region ?? 'us-east-1',
      credentials: {
        accessKeyId: this.aws.accessKeyId as string,
        secretAccessKey: this.aws.secretAccessKey as string,
      },
    }) as S3ClientLike;
    return this.cachedClient;
  }

  private requireBucket(): string {
    this.requireConfig();
    return this.aws.bucket as string;
  }

  private requireConfig(): void {
    if (!this.aws.bucket || !this.aws.accessKeyId || !this.aws.secretAccessKey) {
      throw new ExternalServiceError('S3 storage is not configured', { provider: 's3' });
    }
  }
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new NotFoundError('Stored file was not found');
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === 'object' && body !== null && 'transformToByteArray' in body) {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }

  throw new ExternalServiceError('S3 returned an unreadable object body', { provider: 's3' });
}

function isS3NotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = 'name' in error ? String(error.name) : '';
  const code = 'Code' in error ? String((error as { Code: unknown }).Code) : '';
  const httpStatus = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return name === 'NoSuchKey' || name === 'NotFound' || code === 'NoSuchKey' || httpStatus === 404;
}

function mapS3Error(error: unknown, operation: string): never {
  if (error instanceof ExternalServiceError || error instanceof NotFoundError) {
    throw error;
  }

  if (isS3NotFound(error)) {
    throw new NotFoundError('Stored file was not found');
  }

  throw new ExternalServiceError('S3 storage operation failed', { provider: 's3', operation });
}
