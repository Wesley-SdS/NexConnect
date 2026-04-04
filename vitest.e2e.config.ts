import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.e2e.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@nexconnect/core': path.resolve(__dirname, './libs/core/src'),
      '@nexconnect/database': path.resolve(__dirname, './libs/database/src'),
      '@nexconnect/redis': path.resolve(__dirname, './libs/redis/src'),
      '@nexconnect/shared': path.resolve(__dirname, './libs/shared/src'),
      '@nexconnect/testing': path.resolve(__dirname, './libs/testing/src'),
    },
  },
});
