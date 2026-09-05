import { createHash } from 'node:crypto';

import { ValidationError } from '../errors';
import type { GeneratedFile, ProjectIdentifiers } from './types';

const MAX_SLUG_LENGTH = 40;

export function slugifyProjectName(value: string | null | undefined): string {
  const slug = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
  if (!slug) {
    return 'problem';
  }
  return /^[a-z]/.test(slug) ? slug : `p-${slug}`;
}

export function toPascalCase(slug: string): string {
  const pascal = slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return pascal || 'Problem';
}

export function toCamelCase(slug: string): string {
  const pascal = toPascalCase(slug);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function buildProjectIdentifiers(input: {
  title?: string | null;
  slug?: string | null;
}): ProjectIdentifiers {
  const slug = slugifyProjectName(input.slug || input.title || 'problem');
  const pascal = toPascalCase(slug);
  const camel = toCamelCase(slug);
  return {
    slug,
    pascal,
    camel,
    moduleId: slug,
    permissionRead: `problem.${camel}.read`,
    permissionRun: `problem.${camel}.run`,
    jobName: `problem.${camel}.run`,
    eventType: `problem.${camel}.ran`,
    mountPath: '/problem',
    title: input.title?.trim() || pascal,
  };
}

export function assertRelativeGeneratedPath(filePath: string): string {
  if (
    !filePath ||
    filePath.includes('\\') ||
    filePath.startsWith('/') ||
    filePath.startsWith('./') ||
    filePath.includes('\0') ||
    filePath.split('/').includes('..') ||
    filePath.endsWith('/') ||
    filePath.includes('//')
  ) {
    throw new ValidationError('Generated file path is not allowed', { path: filePath });
  }
  return filePath;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function fileDigest(file: Pick<GeneratedFile, 'path' | 'contents'>): string {
  return sha256Hex(`${file.path}\n${file.contents}`);
}

export function contentDigest(files: readonly GeneratedFile[]): string {
  const parts = [...files]
    .filter((file) => file.path !== 'generation.manifest.json')
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => `${file.path}:${sha256Hex(file.contents)}`);
  return sha256Hex(parts.join('\n'));
}

export function lf(value: string): string {
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

export function withTrailingNewline(value: string): string {
  const normalized = lf(value);
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

export function stableJson(value: unknown): string {
  return withTrailingNewline(JSON.stringify(value, null, 2));
}

export function jsString(value: string): string {
  return JSON.stringify(value);
}
