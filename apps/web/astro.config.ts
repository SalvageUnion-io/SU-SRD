/**
 * The one build (ADR-065): Astro renders the reference site's pages and
 * endpoints (`astro/pages/`) and, in the same client pass, bundles the app
 * (its shell at `build/index.html`, ADR-050) into one `dist/`. One dev server
 * (`astro dev`) serves both.
 */

import { join } from 'node:path'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'astro/config'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, portFor } from 'gates/ports'
import type { Plugin } from 'vite'
import type { VitePluginPWAAPI } from 'vite-plugin-pwa'
import { VitePWA } from 'vite-plugin-pwa'
import { appGraph } from './astro/build/appGraph'
import {
  appShellInDev,
  baseStylesheetModule,
  homebrewInDev,
  requireConvexUrl,
} from './astro/build/appPlugins'
import { authInDev } from './astro/build/devAuth'
import { roomsInDev } from './astro/build/devRooms'
import { referenceStamp } from './astro/build/referenceStamp'
import { site } from './astro/build/site'
import { ROUTER_PLUGIN_OPTIONS } from './routeTree.config'
import { SITE_URL } from './src/lib/constants'
import { SITE_WORKER, WORKBOX_OPTIONS } from './src/pwa'
import { emitBaseStylesheet } from './src/styles/baseStylesheet'

const HERE = import.meta.dirname
const PORT = Number(process.env.PORT ?? portFor())

// Absolute addresses follow the env they are served from
// (`src/lib/constants.ts`): the dev server names itself, for both apps.
if (process.argv.includes('dev')) process.env.VITE_SITE_ORIGIN ||= `http://localhost:${PORT}`

/** The island runtime every reference page loads: what `appGraph` keeps off the app's groups. */
const graph = appGraph({ pageEntries: [join(HERE, 'src/runtime/islands.client.ts')] })

/** An app chunk group: never a module a reference page reaches (`astro/build/appGraph.ts`). */
const notOnPages =
  (pattern: RegExp) =>
  (id: string): boolean =>
    pattern.test(id) && !graph.pageReaches(id)

/** Plugins for the client pass alone: the app and its worker are browser code. */
const clientOnly = (plugins: Plugin | Plugin[]): Plugin[] =>
  [plugins].flat().map((plugin) => ({
    ...plugin,
    applyToEnvironment: (environment) => environment.name === 'client',
  }))

/**
 * The site's one service worker, at `/sw.js` (options and reasons:
 * `src/pwa.ts`). 'prompt', NOT 'autoUpdate': under 'autoUpdate' the plugin
 * force-assigns `skipWaiting` and `clientsClaim`, so a new worker would take
 * over an open builder tab and drop the precache entries it still reads from.
 * `public/sw-lifecycle.js` decides instead. Generated again over the finished
 * site (`site`), since the client pass ends before the pages are written.
 */
const pwa = VitePWA({
  registerType: 'prompt',
  injectRegister: false,
  filename: SITE_WORKER.url.slice(1),
  scope: SITE_WORKER.scope,
  manifest: false,
  workbox: WORKBOX_OPTIONS,
})
const pwaApi = (): VitePluginPWAAPI | undefined =>
  pwa.find((plugin) => plugin.name === 'vite-plugin-pwa')?.api as VitePluginPWAAPI | undefined

/** `name-hash`, as the bundle-budget specs match chunks by prefix (`e2e/_bundle.ts`). */
const HASHED_NAMES = {
  entryFileNames: 'assets/[name]-[hash].js',
  chunkFileNames: 'assets/[name]-[hash].js',
  assetFileNames: 'assets/[name]-[hash][extname]',
}

/**
 * Entries keep their exports but may gain more (`allow-extension`): Astro's
 * `exports-only` refuses the chunk groups' `includeDependenciesRecursively:
 * false`, which keeps an app group from pulling in the reference site's
 * shared modules.
 */
const entrySignatures = clientOnly({
  name: 'entry-signatures',
  apply: 'build',
  options(options) {
    options.preserveEntrySignatures = 'allow-extension'
  },
})

export default defineConfig({
  site: SITE_URL,
  srcDir: './astro',
  publicDir: './public',
  outDir: './dist',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never', assets: 'assets' },
  server: { port: PORT, headers: { [CHECKOUT_HEADER]: CHECKOUT_ROOT } },
  // No renderer integration: the pages render React themselves
  // (`astro/lib/reference.tsx`), and the islands are ours (ADR-065).
  integrations: [site({ pwa: pwaApi })],
  devToolbar: { enabled: false },
  vite: {
    // The app reads `VITE_` variables (`src/env.d.ts`); Astro's default is `PUBLIC_` alone.
    envPrefix: ['VITE_', 'PUBLIC_'],
    plugins: [
      requireConvexUrl(),
      baseStylesheetModule(),
      homebrewInDev(),
      // The Worker's sign-in, on a local database (`astro/build/devAuth.ts`).
      authInDev(),
      // `wrangler dev`, for the rooms (`astro/build/devRooms.ts`).
      roomsInDev(PORT + 1000),
      appShellInDev(),
      // The router's code splitter runs before the JSX transform, or refuses to start.
      ...clientOnly(TanStackRouterVite(ROUTER_PLUGIN_OPTIONS) as Plugin | Plugin[]),
      // Every environment: in dev it turns Vite's own TS transform off and
      // transforms the pages' TSX too.
      react(),
      // The fonts and the UI library's stylesheet, shared by both apps.
      ...clientOnly(emitBaseStylesheet()),
      ...clientOnly(graph.plugin),
      ...entrySignatures,
      ...clientOnly(pwa),
    ],
    // Dev only: pre-bundle every entry point of salvageunion-reference in one
    // pass. Its ORM singletons (the per-schema LazyModels `preload` fills)
    // live in lib/index.ts; served raw beside a pre-bundled '.', the './rules'
    // and './zod' subpaths loaded a SECOND copy that was never preloaded
    // (`Schema "chassis" not loaded`). The package's stamp rides the bundle's
    // intro so a change to its sources re-bundles it (`referenceStamp`).
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
    // A busy port is an error, not the next one: `tools/shot.ts` and the browser
    // preview wait on the port they asked for.
    server: { strictPort: true, watch: { ignored: ['**/routeTree.gen.ts'] } },
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              ...HASHED_NAMES,
              // React, ReactDOM and the scheduler change only on a dependency
              // bump: one long-cached chunk both apps share. The rest are the
              // app's, split by how often each part changes; no group takes a
              // module a reference page reaches (`notOnPages`), or the page
              // would download the whole group. There is deliberately no group
              // for the reference package's data: its JSON is dynamically
              // imported per schema.
              codeSplitting: {
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
      },
      // The stylesheet the pages import is emitted by the render pass.
      prerender: {
        build: { rolldownOptions: { output: { assetFileNames: HASHED_NAMES.assetFileNames } } },
      },
    },
  },
})
