import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://salvageunion.io',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/image'),
      serialize(item) {
        item.lastmod = new Date().toISOString()
        return item
      },
    }),
  ],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      conditions: ['development'],
    },
    // Pre-bundle the game-data package so esbuild inlines its native JSON
    // attribute imports (import(... { with: { type: 'json' } })). Without this
    // the dev server serves those data/schema files as text/javascript and the
    // browser rejects them (JSON module MIME mismatch), so client game-data
    // never loads and entity-card islands hang on their skeleton.
    optimizeDeps: {
      include: ['salvageunion-reference'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/scheduler')
            ) {
              return 'react-vendor'
            }
            if (id.includes('salvageunion-reference')) {
              return 'game-data'
            }
          },
        },
      },
    },
  },
})
