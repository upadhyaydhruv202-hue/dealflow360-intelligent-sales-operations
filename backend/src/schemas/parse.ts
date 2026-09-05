import type { IncomingHttpHeaders } from 'node:http';

import { type ZodError, type ZodTypeAny } from 'zod';

import { ExternalServiceError, ValidationError, type ValidationIssue } from '../errors/app-error';

export type ValidationSource =
  | 'body'
  | 'params'
  | 'query'
  | 'headers'
  | 'file'
  | 'ai'
  | 'provider'
  | 'config'
  | 'job';

export interface ParseOptions {
  source?: ValidationSource;
  message?: string;
}

export function issuesFromZodError(error: ZodError, source?: ValidationSource): ValidationIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.filter((segment) => segment !== undefined && `${segment}` !== '').join('.');
    const qualified = [source, path].filter(Boolean).join('.');

    return {
      path: qualified || source || 'request',
      message: issue.message,
      code: issue.code,
    };
  });
}

export function parseWithSchema<T extends ZodTypeAny>(
  schema: T,
  data: unknown,
  options: ParseOptions = {},
): T['_output'] {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      options.message ?? defaultMessage(options.source),
      issuesFromZodError(result.error, options.source),
    );
  }

  return result.data;
}

export function parseRequest<T extends ZodTypeAny>(schema: T, data: unknown): T['_output'] {
  return parseWithSchema(schema, data, { source: 'body', message: 'Invalid request' });
}

export function parseBody<T extends ZodTypeAny>(schema: T, data: unknown): T['_output'] {
  return parseWithSchema(schema, data, { source: 'body', message: 'Invalid request' });
}

export function parseParams<T extends ZodTypeAny>(schema: T, data: unknown): T['_output'] {
  return parseWithSchema(schema, data, { source: 'params', message: 'Invalid request' });
}

export function parseQuery<T extends ZodTypeAny>(schema: T, data: unknown): T['_output'] {
  return parseWithSchema(schema, data, { source: 'query', message: 'Invalid request' });
}

export function parseHeaders<T extends ZodTypeAny>(
  schema: T,
  headers: IncomingHttpHeaders | unknown,
): T['_output'] {
  return parseWithSchema(schema, headers, { source: 'headers', message: 'Invalid request' });
}

export function parseFileMetadata<T extends ZodTypeAny>(schema: T, data: unknown): T['_output'] {
  return parseWithSchema(schema, data, { source: 'file', message: 'Invalid uploaded file' });
}

export function parseAiOutput<T extends ZodTypeAny>(schema: T, data: unknown): T['_output'] {
  return parseWithSchema(schema, data, {
    source: 'ai',
    message: 'AI output failed schema validation',
  });
}

export function parseProviderResponse<T extends ZodTypeAny>(
  schema: T,
  data: unknown,
  provider = 'external',
): T['_output'] {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ExternalServiceError('External service returned an invalid response', {
      provider,
      issues: issuesFromZodError(result.error, 'provider'),
    });
  }

  return result.data;
}

export function parseConfig<T extends ZodTypeAny>(schema: T, data: unknown): T['_output'] {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = issuesFromZodError(result.error, 'config')
      .map((issue) => `  - ${issue.path}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${details}`);
  }

  return result.data;
}

function defaultMessage(source?: ValidationSource): string {
  switch (source) {
    case 'ai':
      return 'AI output failed schema validation';
    case 'file':
      return 'Invalid uploaded file';
    case 'provider':
      return 'External service returned an invalid response';
    case 'job':
      return 'Invalid job payload';
    default:
      return 'Invalid request';
  }
}
