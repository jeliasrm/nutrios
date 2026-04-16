import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.e2e.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // E2E tests share a single Postgres instance — serialize files and tests
    // so beforeEach cleanup doesn't race between suites.
    fileParallelism: false,
    poolOptions: { threads: { singleThread: true } },
  },
})
