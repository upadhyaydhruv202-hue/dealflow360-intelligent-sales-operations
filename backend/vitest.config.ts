import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', 'tests/e2e/**'],
    setupFiles: ['tests/setup-env.ts'],
    fileParallelism: false,
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/index.ts',
        'src/worker.ts',
      ],
      // Report coverage; do not gate the suite on 100%. Prioritize auth, RBAC, and errors locally.
    },
  },
});
