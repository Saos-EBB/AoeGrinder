import { defineConfig } from 'vitest/config';

// npm test: reine Tests unter tests/ in Node (ohne DOM). Nicht Teil des Builds.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
