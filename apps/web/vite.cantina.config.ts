import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { CHECKOUT_HEADER, CHECKOUT_ROOT } from 'gates/ports'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { ROUTER_PLUGIN_OPTIONS } from './routeTree.config'
import { basePathOf, headersForBase, SITE } from './src/cantina/lib/site'
import { WORKBOX_OPTIONS } from './src/cantina/lib/sw/workbox'
// The shell renders the Union bar from component-lib's TypeScript source, which
// only Vite's module runner resolves: load this file with `--configLoader runner`
// (`build:cantina`, `ssg/dev.ts`); the default loader leaves the package to Node.
import { renderShell } from './src/cantina/shell/shell'
import { publicShells, sitemapXml } from './src/cantina/worker/publicPages'
import { SITE_MANIFEST } from './src/pwa'
import { buildBaseStylesheet, DEV_BASE_STYLESHEET } from './src/styles/baseStylesheet'

/**
 * Every build and dev server talks to a Convex deployment
 * (`src/lib/connection/convexClient.ts`), so one without its URL is refused
 * here rather than shipped as an app that can read and write nothing.
 *
 * A plugin hook, not a check in the config function: Vite runs
 * `configResolved` only when it builds, serves or previews, while tools that
 * merely load the config to read it (knip calls the function for every
 * command and mode) never reach it.
 */
function requireConvexUrl(): Plugin {
  return {
    name: 'cantina-require-convex-url',
    configResolved({ env }) {
      if (env.VITE_CONVEX_URL) return
      throw new Error(
        'VITE_CONVEX_URL is not set. Run `bun run dev`, which writes it into apps/web/.env.local ' +
          'for the local deployment, or pass it in the environment (`convex deploy --cmd-url-env-var-name ' +
          'VITE_CONVEX_URL`, as CI and the deploy do).'
      )
    },
  }
}

/**
 * The Cantina's Vite root, `src/cantina/` (its `main.tsx` and `public/`), and
 * where its build lands: `dist-cantina/`, beside srd's `dist/`, which
 * `tools/merge-dist.sh` copies its `build/` into for the deploy. Everything else
 * this config names is relative to the workspace, `apps/web/`.
 */
const HERE = import.meta.dirname
const ROOT = join(HERE, 'src/cantina')
const DIST = join(HERE, 'dist-cantina')

/**
 * The Cantina is served under `SITE.base`, `/build/` (ADR-048, `src/cantina/lib/site.ts`). The
 * build lands in `dist-cantina/build/` so a file's path on disk is its URL path, and two
 * files move up to `dist-cantina/`, the asset root:
 *
 * - `_headers`, which Static Assets reads only there, with its `/assets/*`
 *   rule scoped to the base;
 * - a copy of `index.html`, because `single-page-application` mode answers a
 *   navigation miss with `/index.html` at the root, whatever the path.
 */
function siteLayout(base: string): Plugin {
  const prefix = basePathOf(base)
  return {
    name: 'cantina-site-layout',
    apply: 'build',
    // `emptyOutDir` clears only `dist-cantina/build/`: files from an older
    // layout must not linger beside it, where Static Assets would serve them.
    buildStart() {
      rmSync(DIST, { recursive: true, force: true })
    },
    closeBundle() {
      const root = DIST
      const out = join(root, prefix)
      copyFileSync(join(out, 'index.html'), join(root, 'index.html'))
      const headers = readFileSync(join(out, '_headers'), 'utf8')
      writeFileSync(join(root, '_headers'), headersForBase(headers, base))
      rmSync(join(out, '_headers'))
    },
  }
}

/**
 * The shell (`src/cantina/shell/shell.ts`) is the app's HTML entry, rendered
 * rather than read from an `index.html` on disk: the build loads it as
 * `index.html` and emits `build/index.html` from it; the dev server answers a
 * navigation with it, after the SPA fallback has rewritten the request to
 * `/index.html` and found no such file.
 */
function cantinaShell(): Plugin {
  const entry = join(ROOT, 'index.html')
  return {
    name: 'cantina-shell',
    enforce: 'pre',
    resolveId(id) {
      return id === entry ? entry : undefined
    },
    load(id) {
      return id === entry ? renderShell() : undefined
    },
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== '/index.html') return next()
          try {
            const html = await server.transformIndexHtml(req.originalUrl ?? '/', renderShell())
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(html)
          } catch (error) {
            next(error)
          }
        })
      }
    },
  }
}

/**
 * The precache, plus the base stylesheet and the fonts it names, which live
 * outside the build (below): `baseStylesheet` adds them before the service
 * worker is generated, as hashed URLs (`revision: null`).
 */
const workbox = {
  ...WORKBOX_OPTIONS,
  additionalManifestEntries: [] as Array<{ url: string; revision: null }>,
}

/** A font subset the precache leaves out (`UNFETCHED_FONT_SUBSETS`). */
const UNFETCHED_SUBSET = /-(latin-ext|vietnamese)-/

/**
 * The base stylesheet both apps link (`src/styles/baseStylesheet.ts`): the fonts and the
 * package stylesheet, at `/assets/base-<hash>.css`, ahead of the Cantina's own
 * CSS. The build writes its files to `dist-cantina/assets/`, the asset root, not
 * `build/`: merge-dist leaves them behind, and the deploy serves srd's identical
 * copy. The dev server links the source, which srd's Vite server answers.
 */
function baseStylesheet(): Plugin {
  let href = DEV_BASE_STYLESHEET
  let build = false
  return {
    name: 'cantina-base-stylesheet',
    configResolved({ command }) {
      build = command === 'build'
    },
    async buildStart() {
      if (!build) return
      const base = await buildBaseStylesheet()
      href = base.href
      workbox.additionalManifestEntries.length = 0
      for (const { fileName } of base.files) {
        if (/\.(css|woff2)$/.test(fileName) && !UNFETCHED_SUBSET.test(fileName)) {
          workbox.additionalManifestEntries.push({ url: `/${fileName}`, revision: null })
        }
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace('</title>', `</title><link rel="stylesheet" href="${href}">`),
    },
    async closeBundle() {
      if (!build) return
      for (const { fileName, source } of (await buildBaseStylesheet()).files) {
        const target = join(DIST, fileName)
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, source)
      }
    },
  }
}

/**
 * The site's one web manifest (`src/pwa.ts`), linked from the shell as srd's
 * pages link it: one install for both apps, opening on the Cantina. After
 * Vite's own pass, which would put the base in front of a root-relative link;
 * the manifest is srd's file, at the site's root, not the Cantina's.
 */
function siteManifest(): Plugin {
  return {
    name: 'cantina-site-manifest',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html.replace('</title>', `</title><link rel="manifest" href="${SITE_MANIFEST}">`),
    },
  }
}

/**
 * The public pages a crawler reads (`src/cantina/worker/publicPages.ts`): the
 * Starter Set's and each build's shell, with its own title, description,
 * canonical and `og:*`, beside the app's, and `sitemap.xml`. Named for the
 * deployment's origin, as `shellOrigin` names the shell's.
 */
function publicPages(base: string): Plugin {
  let origin = SITE.origin
  return {
    name: 'cantina-public-pages',
    apply: 'build',
    configResolved({ env }) {
      origin = (env.VITE_SITE_ORIGIN || SITE.origin).replace(/\/+$/, '')
    },
    writeBundle({ dir = '' }) {
      const prefix = basePathOf(base)
      const shell = readFileSync(join(dir, 'index.html'), 'utf8')
      for (const { file, html } of publicShells(shell, origin, prefix)) {
        mkdirSync(dirname(join(dir, file)), { recursive: true })
        writeFileSync(join(dir, file), html)
      }
      writeFileSync(join(dir, 'sitemap.xml'), sitemapXml(origin, prefix))
    },
  }
}

/**
 * The shell's default link-preview tags (`index.html`'s `cantina:meta` block) name
 * production's address. A Worker Preview's build is given its own origin as
 * `VITE_SITE_ORIGIN` (`deploy-preview.yml`), and its shell names that instead,
 * so a pasted Preview link unfurls with the Preview's image and address. The
 * Worker's per-route tags already use the request's origin (`linkPreview.ts`).
 */
function shellOrigin(base: string): Plugin {
  let origin = ''
  return {
    name: 'cantina-shell-origin',
    apply: 'build',
    configResolved({ env }) {
      origin = (env.VITE_SITE_ORIGIN ?? '').replace(/\/+$/, '')
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return origin ? html.replaceAll(`${SITE.origin}${base}`, `${origin}${base}`) : html
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  root: ROOT,
  // `convex dev` writes `.env.local` into the workspace, not the Vite root.
  envDir: HERE,
  cacheDir: join(HERE, 'node_modules/.vite-cantina'),
  // `/build/`: The Cantina at salvageunion.io/build (ADR-048).
  base: SITE.base,
  plugins: [
    requireConvexUrl(),
    cantinaShell(),
    baseStylesheet(),
    siteManifest(),
    shellOrigin(SITE.base),
    TanStackRouterVite(ROUTER_PLUGIN_OPTIONS),
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
      // Waiting does not mean BOOTING an old build: navigations go to the
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
      workbox,
      // No manifest of its own: the site's one (`public/site.webmanifest`,
      // `src/pwa.ts`), which `siteManifest` links, installs both apps.
      manifest: false,
    }),
    publicPages(SITE.base),
    siteLayout(SITE.base),
  ],
  build: {
    // `dist-cantina/build/`, so a file's path on disk is its URL path.
    outDir: join(DIST, basePathOf(SITE.base)),
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        // Named groups for the code every route loads.
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
            // The app's own code every route loads, as one chunk. Left alone,
            // each module the entry shares with a lazy route became its own
            // sub-kilobyte chunk: a dozen extra requests on every first load.
            // `main.tsx` stays the entry chunk itself, whose URL is the build's
            // name (`entryChunk` in main.tsx, lib/sw/register.ts), and so does
            // `index.html`, the entry module, which sits beside it.
            {
              name: 'app',
              test: /[\\/]apps[\\/]web[\\/](src[\\/]cantina[\\/](?!(main\.tsx|index\.html)$)|convex[\\/])|[\\/]packages[\\/]cantina-domain[\\/]/,
              tags: ['$initial'],
              priority: 5,
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
  // Mirrors srd's optimizeDeps fix in `apps/web/ssg/vite.config.ts`.
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
    entries: ['**/*.{ts,tsx}'],
  },
  server: {
    // Names this checkout when served on its own (`vite -c`); `bun run dev`
    // mounts it in `ssg/dev.ts`, which names the checkout itself.
    headers: { [CHECKOUT_HEADER]: CHECKOUT_ROOT },
    watch: {
      ignored: ['**/routeTree.gen.ts'],
    },
  },
})
