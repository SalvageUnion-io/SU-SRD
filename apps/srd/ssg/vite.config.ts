/**
 * The client-bundle Vite config for the in-house SSG.
 *
 * It lives under `ssg/` (and is passed to `build()` explicitly) rather than at
 * the app root as `vite.config.ts`, so no other tool picks it up implicitly.
 *
 * There is NO server build here: the SSR pass runs under Bun, straight from
 * TypeScript source. Vite only ever produces the browser assets.
 */

import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { sentrySourcemaps } from 'observability/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { WORKBOX_OPTIONS } from './pwa.ts'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const outDir = fileURLToPath(new URL('../dist', import.meta.url))

export default defineConfig({
  root: appRoot,
  base: '/',
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  plugins: [
    react(),
    tailwindcss(),
    // The service worker; its options and their reasons are in ./pwa. No web
    // manifest (public/site.webmanifest is hand-written) and no injected
    // registration: there is no index.html to inject into, and
    // public/registerSW.js carries the `.catch()` that silences SRD-2.
    VitePWA({
      injectRegister: false,
      manifest: false,
      registerType: 'autoUpdate',
      workbox: WORKBOX_OPTIONS,
    }),
    // Must run last; inert without SENTRY_AUTH_TOKEN (see observability/vite).
    ...sentrySourcemaps(outDir),
  ],
  // Fixes a dev-only bug: the island deps live under component-lib/node_modules
  // (@base-ui, sonner, lucide-react, cva) and were only DISCOVERED
  // when an island first imported them, so Vite re-ran its dep optimizer
  // mid-navigation and answered in-flight island chunk requests with 504
  // "Outdated Optimize Dep" — cards stuck on their skeletons, with transient
  // stale-React `jsxDEV` errors.
  //
  // `ssg/dev.ts` runs Vite with `appType: 'custom'` and this app has no
  // index.html anywhere in the root, so Vite's default scanner entry
  // (`**/*.html`) matches nothing: without these explicit entries the optimizer
  // starts from zero and discovers everything lazily, on the first browser
  // request.
  //
  // `include` lists every entry point of salvageunion-reference, not just '.':
  // component-lib's islands import './rules', whose modules import lib/index.ts,
  // so served raw beside a pre-bundled '.' it loaded a second ORM instance whose
  // LazyModels are never preloaded. Bundling every subpath in one pass dedupes
  // lib/index.ts — the same list, and reason, as ITUN's vite.config.ts.
  //
  // Dev-only — `vite build` bundles with Rolldown and no dep optimizer, which
  // is why production was never affected and why this cannot regress the build.
  optimizeDeps: {
    include: [
      'salvageunion-reference',
      'salvageunion-reference/rules',
      'salvageunion-reference/zod',
    ],
    entries: ['src/components/islands/**/*.{ts,tsx}'],
  },
  build: {
    outDir,
    emptyOutDir: true,
    manifest: true,
    rolldownOptions: {
      input: {
        islands: fileURLToPath(new URL('../src/runtime/islands.client.ts', import.meta.url)),
        styles: fileURLToPath(new URL('../src/runtime/styles.entry.ts', import.meta.url)),
        // Neither of the two below is ever linked into a page (see
        // NON_LINKED_ENTRIES in ssg/build.ts). They are entries so that Vite
        // processes the resources they import: `styles` the css, `assets` the
        // static files under `src/assets/` that pages address by manifest key.
        assets: fileURLToPath(new URL('../src/runtime/assets.entry.ts', import.meta.url)),
      },
      output: {
        // React, ReactDOM and the scheduler change only on a dependency bump,
        // so they get their own long-cached chunk. The anchored test matches
        // those three packages exactly (not every `react-*` package), the same
        // group ITUN's vite.config.ts uses.
        //
        // There is deliberately no group for salvageunion-reference: its JSON
        // data files are dynamically imported (ModelFactory dataLoaders), so
        // Rolldown splits them into per-schema chunks that only load when
        // preload() runs. Forcing them into one chunk made every page ship the
        // full ~1.4 MB data corpus via SearchIsland's static imports.
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
