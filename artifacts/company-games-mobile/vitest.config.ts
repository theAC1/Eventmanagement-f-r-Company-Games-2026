import { defineConfig } from 'vitest/config';

// Pure-logic unit tests only (utils). No React Native / Expo runtime is loaded,
// so the default node environment is sufficient.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['utils/**/*.test.ts'],
  },
});
