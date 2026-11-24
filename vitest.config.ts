import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: [
            'packages/core/src/**/*.{test,spec}.ts',
            'packages/mcp/src/**/*.{test,spec}.ts',
          ],
          environment: 'node',
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.nuxt.{test,spec}.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              overrides: {
                devtools: { enabled: false },
                fonts: {
                  providers: {
                    google: false,
                    googleicons: false,
                    bunny: false,
                    fontshare: false,
                    fontsource: false,
                    adobe: false,
                  },
                },
              },
            },
          },
          // Nuxt env boot on a cold cache takes longer than Vitest's default timeouts.
          testTimeout: 60_000,
          hookTimeout: 60_000,
          server: {
            deps: {
              inline: ['svg2pdf.js'],
            },
          },
        },
      }),
    ],
  },
})
