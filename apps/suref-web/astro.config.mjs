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
    // Pre-bundle game-data + every dependency the island components pull in
    // transitively through the `suref-react` workspace source package. The
    // game-data package also needs this so esbuild inlines its native JSON
    // attribute imports (import(... { with: { type: 'json' } })).
    //
    // The other deps live in node_modules but are only *discovered* when an
    // island first imports a suref-react component — which made Vite re-run its
    // dep optimizer mid-navigation, returning 504 "Outdated Optimize Dep" for
    // in-flight island chunks and leaving cards hung on their skeleton (with
    // transient stale-React `jsxDEV` errors). Pinning them optimizes everything
    // on dev startup so no mid-session re-optimization happens.
    //
    // Dev-only: prod is a static rollup build with no dep optimizer, so this
    // churn never affected production.
    optimizeDeps: {
      include: [
        'salvageunion-reference',
        '@base-ui/react/dialog',
        '@base-ui/react/tooltip',
        'class-variance-authority',
        'lucide-react',
        'sonner',
        '@randsum/roller',
      ],
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
