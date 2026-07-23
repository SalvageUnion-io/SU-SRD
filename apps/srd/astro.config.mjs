import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import AstroPWA from '@vite-pwa/astro'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://salvageunion.io',
  output: 'static',
  // 'ignore' (was 'always'): under Astro 7's routing, trailingSlash 'always'
  // appends a slash to the dotted `.json` endpoint routes
  // (src/pages/schema/[schemaId].json.ts → /schema/abilities.json/) and their
  // param resolution then throws "Missing parameter: schemaId" during static
  // generation. 'ignore' stops enforcing trailing slashes on endpoints and the
  // build succeeds. See plan-docs/upgrade-astro-7.md for the SEO trade-off.
  trailingSlash: 'ignore',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/image') && !page.includes('/greembeem'),
    }),
    AstroPWA({
      registerType: 'autoUpdate',
      // Keep the hand-authored public/site.webmanifest (linked from
      // BaseLayout) instead of generating one.
      manifest: false,
      // Emit dist/registerSW.js; BaseLayout loads it with a deferred script.
      injectRegister: 'script-defer',
      workbox: {
        // autoUpdate semantics: new SW activates immediately. vite-plugin-pwa
        // only auto-sets these when injectRegister is 'auto', so be explicit.
        skipWaiting: true,
        clientsClaim: true,
        // Precache the app shell (island JS incl. per-schema data chunks,
        // CSS, fonts, icons) but NOT the 1,586 HTML pages or images.
        globPatterns: ['**/*.{js,css,woff2,svg}'],
        // Static site: pages a user never visited just 404 offline rather
        // than falling back to a stale shell.
        navigateFallback: null,
        runtimeCaching: [
          {
            // Visited pages stay available offline (table use on bad wifi).
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'pages' },
          },
          {
            urlPattern: /\/schema\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'data' },
          },
        ],
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
    // transitively through the `component-lib` workspace source package. The
    // game-data package also needs this so esbuild inlines its dynamic JSON
    // data imports (import('../data/*.json')).
    //
    // The other deps live in node_modules but are only *discovered* when an
    // island first imports a component-lib component — which made Vite re-run its
    // dep optimizer mid-navigation, returning 504 "Outdated Optimize Dep" for
    // in-flight island chunks and leaving cards hung on their skeleton (with
    // transient stale-React `jsxDEV` errors). Pinning them optimizes everything
    // on dev startup so no mid-session re-optimization happens.
    //
    // Dev-only: prod is a static rollup build with no dep optimizer, so this
    // churn never affected production.
    optimizeDeps: {
      include: ['salvageunion-reference'],
      // Scan the island entrypoints up front so Vite discovers + pre-bundles
      // their transitive deps (@base-ui, sonner, lucide-react, cva, @randsum —
      // nested under component-lib/node_modules, so they can't be listed in
      // `include` from this app root). Without this, those deps are only found
      // lazily on first navigation, triggering a mid-session re-optimization.
      entries: ['src/components/islands/**/*.{ts,tsx}'],
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
            // No manual chunk for salvageunion-reference: its JSON data files
            // are dynamically imported (ModelFactory dataLoaders), so Rollup
            // naturally splits them into per-schema chunks that only load when
            // preload() runs. Forcing them into one chunk made every page ship
            // the full ~1.4 MB data corpus via SearchIsland's static imports.
          },
        },
      },
    },
  },
})
