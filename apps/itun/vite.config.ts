import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Sourcemap upload is entirely env-gated on SENTRY_AUTH_TOKEN, mirroring the
// discipline of src/lib/observability.ts: absent locally and in CI (no token
// provisioned there), so the plugin is inert and no sourcemaps are generated
// or shipped. Provisioned only on the Netlify production build via site env
// vars (SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT — not committed).
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

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
    // Must run last in the plugins array (Sentry's own requirement — it needs
    // to see the final Rollup output to attach + upload sourcemaps). Inert
    // (returns nothing) unless sentryAuthToken is set.
    sentryAuthToken
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: sentryAuthToken,
          // Explicit release name pinned to the same VITE_COMMIT_REF the
          // client tags itself with at runtime (src/lib/observability.ts) —
          // auto-detecting from git would use Netlify's shallow clone and
          // could silently mismatch, which breaks sourcemap resolution.
          release: { name: process.env.VITE_COMMIT_REF, inject: false },
          sourcemaps: {
            filesToDeleteAfterUpload: ['dist/**/*.map'],
          },
          // Observability tooling that can take down a deploy is an
          // anti-pattern: an expired token, wrong org/project, or a Sentry
          // API blip should degrade to "no sourcemaps this deploy", not fail
          // the Netlify build. Warn instead of the plugin's default throw.
          errorHandler: (error) => {
            console.warn('[sentry-vite-plugin] sourcemap upload failed (non-fatal):', error)
          },
        })
      : false,
  ],
  build: {
    // Only emit sourcemaps when actually uploading them (see sentryAuthToken
    // above) — the upload step deletes them from dist/ afterward, so default
    // builds (local, CI, unconfigured deploys) never generate or ship maps.
    sourcemap: !!sentryAuthToken,
  },
  // Pre-bundle the game-data package so esbuild inlines its dynamic
  // `import('../data/*.json', { with: { type: 'json' } })` (+ schema) imports.
  // Without this, vite dev serves those JSON modules as `text/javascript`, which
  // strict browsers reject under import-attribute enforcement ("Failed to fetch
  // dynamically imported module"), breaking all reference-data loading in dev.
  // Mirrors the srd astro.config optimizeDeps fix (#260).
  //
  // List EVERY imported entry point of salvageunion-reference (main + each
  // subpath), not just '.'. The package's stateful ORM singletons — the
  // per-schema LazyModel instances that preload('all') installs data into —
  // live in lib/index.ts. If only '.' is pre-bundled, esbuild bakes one copy
  // of lib/index.ts into deps/salvageunion-reference.js, while the './rules'
  // and './zod' subpaths (served as raw source) pull a SECOND copy of
  // lib/index.ts with its own, never-preloaded LazyModel singletons. Rules
  // helpers (mechMaxSP/crawlerMaxSP via 'salvageunion-reference/rules') then
  // read that un-preloaded copy and throw `Schema "chassis" not loaded` even
  // though GameDataReady already preloaded the main-entry copy. Listing the
  // subpaths here makes esbuild bundle them in one pass and dedupe lib/index.ts
  // to a single shared instance. (ADR-006 moved the rules modules into the
  // package behind the './rules' subpath, which is what first split the
  // instance.)
  optimizeDeps: {
    include: [
      'salvageunion-reference',
      'salvageunion-reference/rules',
      'salvageunion-reference/zod',
    ],
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
