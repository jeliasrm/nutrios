import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.e2e.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/app.module.ts',
        'src/**/*.module.ts',
        'src/**/index.ts',
        'src/auth/auth.types.ts',
        'src/**/*.e2e.test.ts',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
