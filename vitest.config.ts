import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['shared/cad/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.nuxt.{test,spec}.ts'],
          environment: 'nuxt',
          // Nuxt env boot on a cold cache takes longer than Vitest's 5s default.
          testTimeout: 30_000,
        },
      }),
    ],
  },
})
