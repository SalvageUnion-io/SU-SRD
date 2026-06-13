import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    tailwindcss(),
    react({
      jsxRuntime: 'automatic',
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'ITUN — In The Union Now',
        short_name: 'ITUN',
        description: 'Local-first character builder for Salvage Union',
        // Cargo hazard-stripe brand (design §1.5): ink plate / paper ground.
        theme_color: '#282019',
        background_color: '#f3ede2',
        display: 'standalone',
        icons: [
          // Rasterized from public/favicon.svg (Cargo hazard-stripe plate).
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  // Pre-bundle the game-data package so esbuild inlines its dynamic
  // `import('../data/*.json', { with: { type: 'json' } })` (+ schema) imports.
  // Without this, vite dev serves those JSON modules as `text/javascript`, which
  // strict browsers reject under import-attribute enforcement ("Failed to fetch
  // dynamically imported module"), breaking all reference-data loading in dev.
  // Mirrors the suref-web astro.config optimizeDeps fix (#260).
  optimizeDeps: {
    include: ['salvageunion-reference'],
    entries: ['index.html', 'src/**/*.{ts,tsx}'],
  },
  server: {
    watch: {
      ignored: ['**/routeTree.gen.ts'],
    },
    // Snapshot API dev proxy (plan 2.9). In production Netlify redirects map
    // /api/snapshots[/:id] to the two functions (netlify.toml); plain
    // `vite dev` has no such layer, so PublishButton would 404. Run
    //   bunx netlify functions:serve        (port 9999)
    // alongside `bun run dev:itun` and this proxy replicates the redirect
    // mapping. Without the functions server, publish requests fail with a
    // connection error and the UI's feature-detection treats publishing as
    // unavailable. See README.md ("Snapshot publishing in dev").
    proxy: {
      '/api/snapshots': {
        target: 'http://localhost:9999',
        changeOrigin: true,
        rewrite: (path) => {
          // /api/snapshots/<id> → snapshot-retrieve (id read from last path segment)
          // /api/snapshots      → snapshot-publish (method handling inside the fn)
          const match = path.match(/^\/api\/snapshots\/([^/?#]+)/)
          return match
            ? `/.netlify/functions/snapshot-retrieve/${match[1]}`
            : '/.netlify/functions/snapshot-publish'
        },
      },
    },
  },
})
