import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only run src/__tests__/ in CI. The tests/ directory contains integration
    // tests that require a fully migrated + seeded database — run those locally.
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/__tests__/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/database/migrations/',
        'scripts/',
      ],
      // Thresholds are not enforced in CI — unit test suite covers key paths
      // but full coverage requires integration tests run against a live DB.
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
