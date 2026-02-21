import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://salvageunion.io',
  output: 'static',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/image'),
    }),
  ],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  vite: {
    plugins: [tailwindcss()],
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
