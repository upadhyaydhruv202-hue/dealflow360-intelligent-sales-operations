import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadProblemModule, resolveProblemModuleEntry } from './load';

describe('resolveProblemModuleEntry', () => {
  it('points at the compiled or source problem module', () => {
    const entry = resolveProblemModuleEntry();
    expect(fs.existsSync(entry)).toBe(true);
    expect(entry.replaceAll('\\', '/')).toMatch(/modules\/problem\/(dist\/index\.js|src\/index\.ts)$/);
  });
});

describe('loadProblemModule', () => {
  it('loads the DealFlow360 module contract', () => {
    const module = loadProblemModule();
    expect(module.id).toBe('dealflow');
    expect(module.permissions.map((permission) => permission.key)).toEqual(
      expect.arrayContaining(['dealflow.quotes.read', 'dealflow.quotes.write']),
    );
    expect(typeof module.register).toBe('function');
  });
});
