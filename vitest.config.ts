import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.e2e.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.spec.ts', '**/*.e2e.spec.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@nexconnect/core': path.resolve(__dirname, './libs/core/src/index.ts'),
      '@nexconnect/database': path.resolve(__dirname, './libs/database/src/index.ts'),
      '@nexconnect/redis': path.resolve(__dirname, './libs/redis/src/index.ts'),
      '@nexconnect/shared': path.resolve(__dirname, './libs/shared/src/index.ts'),
      '@nexconnect/testing': path.resolve(__dirname, './libs/testing/src/index.ts'),
    },
    extensions: ['.ts', '.mts', '.cts', '.js', '.json'],
  },
});
