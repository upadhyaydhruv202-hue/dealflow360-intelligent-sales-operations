import { describe, expect, it, vi } from 'vitest';

import { shouldSyncRbacCatalog, syncRbacCatalogIfEnabled } from './seed-catalog';

describe('shouldSyncRbacCatalog', () => {
  it('runs in local development, not in test or production', () => {
    expect(shouldSyncRbacCatalog({ isProduction: false, isTest: false })).toBe(true);
    expect(shouldSyncRbacCatalog({ isProduction: false, isTest: true })).toBe(false);
    expect(shouldSyncRbacCatalog({ isProduction: true, isTest: false })).toBe(false);
  });
});

describe('syncRbacCatalogIfEnabled', () => {
  it('skips when there is no database or the environment is test/production', async () => {
    const logger = { info: vi.fn() };

    await expect(
      syncRbacCatalogIfEnabled({
        config: { isProduction: false, isTest: false },
        prisma: null,
        logger,
      }),
    ).resolves.toBe(false);

    await expect(
      syncRbacCatalogIfEnabled({
        config: { isProduction: false, isTest: true },
        prisma: {} as never,
        logger,
      }),
    ).resolves.toBe(false);

    await expect(
      syncRbacCatalogIfEnabled({
        config: { isProduction: true, isTest: false },
        prisma: {} as never,
        logger,
      }),
    ).resolves.toBe(false);

    expect(logger.info).not.toHaveBeenCalled();
  });
});
