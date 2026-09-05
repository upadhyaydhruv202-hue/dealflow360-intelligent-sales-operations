import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { ProblemModule } from './types';

const nodeRequire = createRequire(__filename);

let cached: ProblemModule | undefined;

export function resolveProblemModuleEntry(): string {
  const root = path.resolve(__dirname, '../../../modules/problem');
  const distJs = path.join(root, 'dist/index.js');
  const srcTs = path.join(root, 'src/index.ts');

  // Compiled API/worker must load dist. tsx can require .ts. Vitest's createRequire
  // cannot, so tests use dist (built in tests/setup-env.ts).
  const runningFromTypeScript = __filename.endsWith('.ts');
  const underVitest = Boolean(process.env.VITEST);
  if (runningFromTypeScript && !underVitest && fs.existsSync(srcTs)) {
    return srcTs;
  }
  if (fs.existsSync(distJs)) {
    return distJs;
  }
  if (fs.existsSync(srcTs)) {
    return srcTs;
  }
  throw new Error(
    'Problem module not found. Expected modules/problem/dist/index.js or modules/problem/src/index.ts.',
  );
}

export function loadProblemModule(): ProblemModule {
  cached ??= unwrapProblemModule(nodeRequire(resolveProblemModuleEntry()));
  return cached;
}

export function resetProblemModuleCache(): void {
  cached = undefined;
}

function unwrapProblemModule(loaded: unknown): ProblemModule {
  if (isProblemModule(loaded)) {
    return loaded;
  }

  if (loaded && typeof loaded === 'object') {
    const record = loaded as Record<string, unknown>;
    if (isProblemModule(record.problemModule)) {
      return record.problemModule;
    }
    if (isProblemModule(record.default)) {
      return record.default;
    }
  }

  throw new Error('Problem module must export problemModule with id, permissions, and register()');
}

function isProblemModule(value: unknown): value is ProblemModule {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    record.id.trim().length > 0 &&
    Array.isArray(record.permissions) &&
    typeof record.register === 'function'
  );
}
