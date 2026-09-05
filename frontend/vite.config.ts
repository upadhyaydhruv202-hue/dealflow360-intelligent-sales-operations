import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      '@hackathon/api-contract': path.resolve(rootDir, '../packages/api-contract/src/index.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/v1/realtime': {
        target: apiProxyTarget,
        changeOrigin: true,
        timeout: 3_600_000,
        proxyTimeout: 3_600_000,
      },
      '/api': { target: apiProxyTarget, changeOrigin: true },
      '/health': { target: apiProxyTarget, changeOrigin: true },
      '/ready': { target: apiProxyTarget, changeOrigin: true },
    },
  },
});
