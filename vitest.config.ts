import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      thresholds: {
        statements: 75,
        branches: 70,
        functions: 80,
        lines: 75,
      },
      exclude: ['src/index.ts', 'src/selectors/types.ts'],
    },
  },
})
