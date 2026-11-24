// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/eslint',
    '@pinia/nuxt',
    (_, nuxt) => {
      nuxt.hook('pages:extend', (pages) => {
        if (nuxt.options.dev) return
        for (let i = pages.length - 1; i >= 0; i--) {
          if (pages[i]?.path === '/_tema') {
            pages.splice(i, 1)
          }
        }
      })
    },
  ],
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Temandor',
      link: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    },
  },
  css: ['~/assets/css/main.css'],
  ui: {
    colorMode: false,
  },
  build: {
    transpile: ['@temandor/core'],
  },
  routeRules: {
    '/': { prerender: true },
    '/docs': { prerender: true },
    '/proyek': { ssr: false },
    '/proyek/**': { ssr: false },
    '/editor/**': { ssr: false },
  },
  compatibilityDate: '2025-07-15',
  nitro: {
    prerender: {
      routes: ['/', '/docs'],
    },
  },
  eslint: {
    config: {
      stylistic: true,
    },
  },
  fonts: {
    families: [
      { name: 'Barlow', weights: [400, 500, 600, 700], styles: ['normal', 'italic'] },
      { name: 'Barlow Condensed', weights: [600, 700], styles: ['normal'] },
      { name: 'JetBrains Mono', weights: [400, 500, 700], styles: ['normal'] },
    ],
    defaults: {
      subsets: ['latin'],
    },
  },
})
