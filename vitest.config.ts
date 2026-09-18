import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const resolvePath = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@medentry/shared': resolvePath('./packages/shared/src/index.ts'),
      '@medentry/protocols': resolvePath('./packages/protocols/src/index.ts'),
      '@medentry/domain': resolvePath('./packages/domain/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
