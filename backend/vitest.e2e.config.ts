import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    fileParallelism: false,
    restoreMocks: true,
    unstubEnvs: true,
    testTimeout: 30_000,
  },
});
