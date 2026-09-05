import fs from 'node:fs/promises';
import path from 'node:path';

import { ConflictError, ValidationError } from '../errors';
import { sha256Hex } from './identifiers';
import { withWriteMode } from './engine';
import type {
  ProjectGenerationResult,
  WriteGeneratedProjectOptions,
  WriteGeneratedProjectResult,
  WrittenFileRecord,
} from './types';

const GENERATED_DIR_NAME = 'generated';

export function generatedProjectsRoot(kitRoot: string): string {
  return path.resolve(kitRoot, GENERATED_DIR_NAME, 'projects');
}

export function defaultOutputRoot(kitRoot: string, slug: string): string {
  return path.join(generatedProjectsRoot(kitRoot), slug);
}

export async function findKitRoot(start = process.cwd()): Promise<string> {
  let dir = path.resolve(start);
  for (let depth = 0; depth < 10; depth += 1) {
    try {
      const raw = await fs.readFile(path.join(dir, 'package.json'), 'utf8');
      const pkg = JSON.parse(raw) as { name?: string; workspaces?: unknown };
      if (pkg.name === 'hackathon-starter-kit' && Array.isArray(pkg.workspaces)) {
        return dir;
      }
    } catch {
      // keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new ValidationError('Could not locate the starter kit root for isolated generation');
}

export function assertOutputSandbox(kitRoot: string, outputRoot: string): string {
  const resolvedKit = path.resolve(kitRoot);
  const resolvedOut = path.resolve(outputRoot);
  const generatedRoot = path.resolve(resolvedKit, GENERATED_DIR_NAME);

  if (resolvedOut === resolvedKit) {
    throw new ValidationError('Refusing to write into the starter kit root');
  }
  if (!isInside(resolvedOut, generatedRoot)) {
    throw new ValidationError('Generated output must stay under generated/', {
      outputRoot: resolvedOut,
      requiredRoot: generatedRoot,
    });
  }

  const forbidden = ['backend', 'frontend', 'workers', 'database', 'modules'].map((segment) =>
    path.resolve(resolvedKit, segment),
  );
  if (forbidden.some((root) => resolvedOut === root || isInside(resolvedOut, root))) {
    throw new ValidationError('Refusing to write into starter kit source trees', { outputRoot: resolvedOut });
  }

  return resolvedOut;
}

export async function writeGeneratedProject(
  result: ProjectGenerationResult,
  options: WriteGeneratedProjectOptions,
): Promise<WriteGeneratedProjectResult> {
  const outputRoot = assertOutputSandbox(options.kitRoot, options.outputRoot);
  const generatedAt = result.generationManifest.generatedAt;
  const toWrite = options.dryRun ? result : withWriteMode(result, generatedAt);
  const relativeRoot = path.relative(path.resolve(options.kitRoot), outputRoot).replaceAll('\\', '/');

  if (options.dryRun) {
    return {
      outputRoot,
      relativeRoot,
      dryRun: true,
      files: toWrite.files.map((file) => toWritten(file, 'preview')),
      contentDigest: toWrite.contentDigest,
      configurationDigest: toWrite.configurationDigest,
      generationManifest: toWrite.generationManifest,
    };
  }

  await fs.mkdir(outputRoot, { recursive: true });
  const written: WrittenFileRecord[] = [];
  for (const file of toWrite.files) {
    const target = resolveOutputFile(outputRoot, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    let status: WrittenFileRecord['status'] = 'written';
    try {
      const existing = await fs.readFile(target, 'utf8');
      if (existing === file.contents) {
        status = 'unchanged';
      } else if (options.overwrite === false) {
        throw new ConflictError('Refusing to overwrite an existing generated file', { path: file.path });
      }
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
    }
    if (status === 'written') {
      await fs.writeFile(target, file.contents, 'utf8');
    }
    written.push(toWritten(file, status));
  }

  return {
    outputRoot,
    relativeRoot,
    dryRun: false,
    files: written,
    contentDigest: toWrite.contentDigest,
    configurationDigest: toWrite.configurationDigest,
    generationManifest: toWrite.generationManifest,
  };
}

function resolveOutputFile(outputRoot: string, relativePath: string): string {
  const target = path.resolve(outputRoot, ...relativePath.split('/'));
  if (!isInside(target, outputRoot) && target !== outputRoot) {
    throw new ValidationError('Generated file escaped the output root', { path: relativePath });
  }
  return target;
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function toWritten(
  file: { path: string; contents: string; role: WrittenFileRecord['role']; capability?: string },
  status: WrittenFileRecord['status'],
): WrittenFileRecord {
  return {
    path: file.path,
    role: file.role,
    sha256: sha256Hex(file.contents),
    bytes: Buffer.byteLength(file.contents, 'utf8'),
    status,
    ...(file.capability ? { capability: file.capability } : {}),
  };
}
