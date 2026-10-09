import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { readChangelog } from 'component-lib/changelog/git'
import { sentrySourcemaps } from 'observability/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { ROUTER_PLUGIN_OPTIONS } from './routeTree.config'
import { WORKBOX_OPTIONS } from './src/lib/sw/workbox'

// https://vite.dev/config/
export default defineConfig({
  // `feat`/`fix`/`perf` squash titles scoped `itun` (ADR-041).
  define: { __ITUN_CHANGELOG__: JSON.stringify(readChangelog('itun', 'App')) },
  plugins: [
    TanStackRouterVite(ROUTER_PLUGIN_OPTIONS),
    tailwindcss(),
    // `@vitejs/plugin-react-swc` always uses the automatic JSX runtime, so the
    // explicit `jsxRuntime: 'automatic'` the Babel plugin needed is gone — it
    // is not an option on this plugin and would be rejected.
    react(),
    VitePWA({
      // 'prompt', NOT 'autoUpdate' — this is the setting that made share links
      // need four or five refreshes.
      //
      // Under 'autoUpdate' the plugin FORCE-ASSIGNS `workbox.skipWaiting` and
      // `workbox.clientsClaim` to true (dist/index.js: an assignment, not a
      // default, so setting them in `workbox` below cannot override it). The
      // emitted worker then activates the moment it finishes installing and
      // takes over the already-open page, and activating removes every
      // precache entry the new build no longer lists — the entries the live
      // page is still reading from. That page goes on requesting hashed chunks
      // from a build the server no longer has, and every one of them fails.
      // Reloading is the only way out, which is precisely the symptom: a
      // snapshot link that renders on the fifth try, once the ~1.2 MB precache
      // install has finally finished.
      //
      // Under 'prompt' the new worker installs and then WAITS. The running
      // page keeps the precache it booted with, so its chunks stay resolvable
      // for as long as it is open, and the swap happens only when the page
      // asks (src/lib/sw/register.ts posts SKIP_WAITING and reloads) or when
      // every tab has closed. Nothing is yanked from under a running page.
      //
      // Waiting no longer means BOOTING an old build: navigations go to the
      // network first (src/lib/sw/workbox.ts), so every page load gets the
      // deployed shell and the precache is only the offline fallback. What a
      // waiting worker still delays is the precache catching up, and a tab
      // that stays open across a deploy — which is why register.ts checks for
      // updates while a tab is open, why the backend's build floor reloads a
      // tab older than it (src/lib/connection/buildFloor.ts), and why
      // installChunkRecovery still exists as the backstop for the tab that was
      // already mid-flight when a deploy landed.
      registerType: 'prompt',
      // main.tsx registers through `virtual:pwa-register`; the plugin injects
      // no second registration script into index.html.
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      workbox: WORKBOX_OPTIONS,
      manifest: {
        name: 'ITUN — In The Union Now',
        short_name: 'ITUN',
        // index.html's meta description, verbatim (lib/__tests__/manifestDescription.test.ts).
        description:
          'Build and run Salvage Union pilots, mechs and Union Crawlers. Character sheets, roster management and shareable live sheets for the post-apocalyptic mech TTRPG.',
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
    // Must run last; inert without SENTRY_AUTH_TOKEN (see observability/vite).
    ...sentrySourcemaps('dist'),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Named groups for the code every route loads (audit AP-11).
        //
        // Left to itself, Rolldown folded React, component-lib, the reference
        // ORM and the rest of the initial graph into ONE ~600 KB chunk named
        // after whichever module it happened to pick (`src-*.js`). One chunk
        // means one download that cannot start until the entry is parsed, and
        // a new hash — so a full re-download — on every deploy that touches
        // any line of app or library code.
        //
        // Splitting it by how often each part changes fixes both: third-party
        // code (which changes only on a dependency bump) and Zod stay cached
        // across ordinary deploys, and the pieces download in parallel.
        //
        // `tags: ['$initial']` is the load-bearing part. It restricts a group
        // to modules the entry reaches STATICALLY, so a library only one lazy
        // route uses (qrcode, for the share dialog) stays in that route's
        // chunk instead of being hoisted into a vendor chunk every visitor
        // downloads. Without it a `node_modules` group would undo the route
        // splitting above.
        //
        // Priority decides who claims a module first, and each group also
        // pulls in its dependencies, so the order matters: Zod and React
        // (the two largest, most stable libraries, each its own chunk) before
        // the rest of node_modules, node_modules before component-lib (whose
        // dependencies would otherwise drag React into the component-lib
        // chunk).
        codeSplitting: {
          groups: [
            { name: 'zod', test: /[\\/]node_modules[\\/].*[\\/]zod[\\/]/, priority: 40 },
            {
              name: 'react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              tags: ['$initial'],
              priority: 35,
            },
            { name: 'vendor', test: /[\\/]node_modules[\\/]/, tags: ['$initial'], priority: 30 },
            {
              name: 'reference',
              test: /[\\/]packages[\\/]salvageunion-reference[\\/]lib[\\/]/,
              tags: ['$initial'],
              priority: 20,
            },
            {
              name: 'component-lib',
              test: /[\\/]packages[\\/]component-lib[\\/]/,
              tags: ['$initial'],
              priority: 10,
            },
          ],
        },
      },
    },
  },
  // Pre-bundle the game-data package so esbuild inlines its dynamic
  // `import('../data/*.json', { with: { type: 'json' } })` (+ schema) imports.
  // Without this, vite dev serves those JSON modules as `text/javascript`, which
  // strict browsers reject under import-attribute enforcement ("Failed to fetch
  // dynamically imported module"), breaking all reference-data loading in dev.
  // Mirrors srd's optimizeDeps fix in `apps/srd/ssg/vite.config.ts` (#260).
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
  },
})
