/**
 * The one Vite config: srd and the app, built in one pass into one `dist/`
 * (ADR-050), and served by the one dev server (`ssg/dev.ts`).
 *
 * - **srd** is three client entries (`src/runtime/`) the SSG links into every
 *   page it pre-renders: `ssg/build.ts` runs this build, reads its manifest,
 *   then renders the pages under Bun. There is no server build.
 * - **The app** is one HTML entry, its shell, rendered rather than read
 *   (`ssg/appPlugins.ts`) and emitted as `build/index.html`. Its chunks
 *   share `assets/` with srd's; its router and service worker live under
 *   `/build/` (`APP_BASE` in `src/lib/appBase.ts`, ADR-048).
 *
 * The shell renders the Union bar from the UI library's TypeScript source,
 * which only Vite's module runner resolves: load this file with
 * `configLoader: 'runner'` (`ssg/bundle.ts`, `ssg/dev.ts`).
 */

import { join } from 'node:path'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { CHECKOUT_HEADER, CHECKOUT_ROOT } from 'gates/ports'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { ROUTER_PLUGIN_OPTIONS } from './routeTree.config'
import { SITE_WORKER, WORKBOX_OPTIONS } from './src/pwa'
import { emitBaseStylesheet } from './src/styles/baseStylesheet'
import { appGraph } from './ssg/appGraph'
import {
  APP_ENTRY,
  appShell,
  baseStylesheetLink,
  prerender,
  publicPages,
  requireConvexUrl,
  shellOrigin,
  siteManifest,
} from './ssg/appPlugins'
import { referenceStamp } from './ssg/referenceStamp'

const HERE = import.meta.dirname
const OUT_DIR = join(HERE, 'dist')

/** srd's client entries, by input key: the chunks `ssg/build.ts` links. */
const SRD_INPUT = {
  islands: join(HERE, 'src/runtime/islands.client.ts'),
  // These two are never linked into a page (NON_LINKED_ENTRIES in
  // ssg/build.ts): `styles` exists for its css, `assets` for the static files
  // under `src/assets/` that pages address by manifest key.
  styles: join(HERE, 'src/runtime/styles.entry.ts'),
  assets: join(HERE, 'src/runtime/assets.entry.ts'),
}

/** The app's entry, by input key (`APP_CHUNK` in ssg/build.ts). */
const APP_CHUNK = 'app'

const graph = appGraph({ pageEntries: Object.values(SRD_INPUT) })

/** An app chunk group: never a module an srd page reaches (`ssg/appGraph.ts`). */
const notOnPages =
  (pattern: RegExp) =>
  (id: string): boolean =>
    pattern.test(id) && !graph.pageReaches(id)

// https://vite.dev/config/
export default defineConfig({
  root: HERE,
  base: '/',
  publicDir: join(HERE, 'public'),
  plugins: [
    requireConvexUrl(),
    appShell(),
    baseStylesheetLink(),
    siteManifest(),
    shellOrigin(),
    TanStackRouterVite(ROUTER_PLUGIN_OPTIONS),
    react(),
    // The fonts and the UI library's stylesheet, shared by both apps.
    emitBaseStylesheet(),
    graph.plugin,
    // The site's one service worker, at `/sw.js` (options and reasons:
    // `src/pwa.ts`). 'prompt', NOT 'autoUpdate': under 'autoUpdate' the plugin
    // force-assigns `skipWaiting` and `clientsClaim`, so a new worker would
    // take over an open builder tab and drop the precache entries it still
    // reads from. `public/sw-lifecycle.js` decides instead. Both render modes
    // register this one `SITE_WORKER`: the builder through
    // `virtual:pwa-register` (`src/main.tsx`), the reference's pages through
    // `registerSiteWorker` (`src/lib/sw/siteWorker.ts`); neither is injected.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      filename: SITE_WORKER.url.slice(1),
      scope: SITE_WORKER.scope,
      // The site's one manifest (`public/site.webmanifest`, `src/pwa.ts`).
      manifest: false,
      workbox: WORKBOX_OPTIONS,
      // After `prerender` writes the pages: the precache needs the home page.
      integration: { closeBundleOrder: 'post' },
    }),
    publicPages(),
    prerender(),
  ],
  // Dev only: pre-bundle every entry point of salvageunion-reference in one
  // pass. Its ORM singletons (the per-schema LazyModels `preload` fills) live
  // in lib/index.ts; served raw beside a pre-bundled '.', the './rules' and
  // './zod' subpaths loaded a SECOND copy that was never preloaded
  // (`Schema "chassis" not loaded`). Pre-bundling also inlines its JSON
  // imports, which strict browsers refuse as `text/javascript`. `entries`
  // names both apps' sources: `ssg/dev.ts` serves no index.html for Vite's
  // default scan, and deps discovered on first request re-ran the optimizer
  // mid-navigation (504 "Outdated Optimize Dep"). `vite build` has no dep
  // optimizer, so none of this reaches production. The package's stamp rides
  // the bundle's intro so a change to its sources re-bundles it
  // (`referenceStamp`): Vite would otherwise keep serving the stale copy.
  optimizeDeps: {
    include: [
      'salvageunion-reference',
      'salvageunion-reference/rules',
      'salvageunion-reference/zod',
    ],
    rolldownOptions: {
      output: {
        intro: `/* salvageunion-reference ${referenceStamp(join(HERE, '../../packages/salvageunion-reference'))} */`,
      },
    },
    entries: [
      'src/main.tsx',
      'src/routes/**/*.{ts,tsx}',
      'src/components/islands/**/*.{ts,tsx}',
      '!**/__tests__/**',
    ],
  },
  server: {
    // `ssg/dev.ts` names the checkout itself; this covers `vite` run directly.
    headers: { [CHECKOUT_HEADER]: CHECKOUT_ROOT },
    watch: { ignored: ['**/routeTree.gen.ts'] },
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    // How `ssg/build.ts` learns srd's hashed entry names; it deletes the file.
    manifest: true,
    rolldownOptions: {
      input: { ...SRD_INPUT, [APP_CHUNK]: APP_ENTRY },
      output: {
        // React, ReactDOM and the scheduler change only on a dependency bump:
        // one long-cached chunk both apps share.
        //
        // The rest are the app's, for the code every route loads. Left to
        // itself, Rolldown folded its initial graph into ONE ~600 KB chunk
        // that every deploy re-hashed; split by how often each part changes,
        // third-party code and Zod stay cached and download in parallel.
        // `tags: ['$initial']` keeps a library only one lazy route uses (qrcode)
        // in that route's chunk. Priority decides who claims a module first.
        //
        // No group takes a module an srd page reaches (`notOnPages`): the page
        // would download the whole group. Those split as Rolldown shares them.
        // There is deliberately no group for the reference package's data:
        // its JSON is dynamically imported per schema, and one chunk would
        // ship the full ~1.4 MB corpus to every page.
        codeSplitting: {
          // A group does not pull in what its modules import: the app's
          // groups import srd's shared modules, which must stay where srd's
          // pages load them. srd's modules import nothing of the app's,
          // so nothing they reach is in a group and no chunk cycles back.
          includeDependenciesRecursively: false,
          groups: [
            {
              name: 'zod',
              test: notOnPages(/[\\/]node_modules[\\/].*[\\/]zod[\\/]/),
              priority: 40,
            },
            {
              name: 'react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 35,
            },
            {
              name: 'vendor',
              test: notOnPages(/[\\/]node_modules[\\/]/),
              tags: ['$initial'],
              priority: 30,
            },
            {
              name: 'reference',
              test: notOnPages(/[\\/]packages[\\/]salvageunion-reference[\\/]lib[\\/]/),
              tags: ['$initial'],
              priority: 20,
            },
            // The app's own code every route loads, as one chunk, not a
            // dozen sub-kilobyte ones. `main.tsx` stays the entry chunk itself,
            // whose URL is the build's name (`entryChunk` in main.tsx).
            {
              name: 'app',
              test: notOnPages(
                /[\\/]apps[\\/]web[\\/](src[\\/](?!main\.tsx$)|convex[\\/])|[\\/]packages[\\/]game-domain[\\/]/
              ),
              tags: ['$initial'],
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
