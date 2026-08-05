/**
 * build — the SSG orchestrator.
 *
 *   1. `vite build` (client only): the islands entry, the css entry and the
 *      static-asset entry, with a manifest.
 *   2. read `dist/.vite/manifest.json` -> entry JS + CSS urls, and the emitted
 *      url of every asset under `src/assets/`.
 *   3. enumerate `ssg/routes.ts` and render each route.
 *   4. write endpoints and the sitemap.
 *   5. `ssg/pwa.ts`: registerSW.js, then workbox generateSW over the finished
 *      dist — LAST, because it globs whatever steps 1-4 left there.
 *   6. `public/` is copied by Vite in step 1.
 *
 * ## The css/SSR hazard
 *
 * Step 3 runs under Bun, NOT through Vite. `component-lib`'s barrel reaches
 * `DashboardCanvas.tsx` / `DashboardGrid.tsx`, both of which `import './x.css'`,
 * so every SSR render pulls stylesheets into a runtime that has no css loader.
 * Bun happens to load `.css` as a text module today, which is why this "works"
 * unguarded — but that is an implementation detail of the runtime, and the
 * first `@fontsource` import that drifts into an SSR module would break it.
 * The `Bun.plugin` below stubs `.css` to an empty module so the behaviour is
 * ours rather than the runtime's.
 *
 * The plugin only affects modules loaded AFTER it is registered, so everything
 * downstream of it is imported dynamically — do not turn those `await import`s
 * into top-level imports.
 */

import { plugin } from 'bun'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build as viteBuild } from 'vite'
// Type-only, so it is erased before Bun ever resolves `./document` — that module
// reaches `BaseLayout` -> `component-lib` -> `*.css` and must not be loaded here
// ahead of the css-stub plugin below.
import type { BuildAssets } from './document'
import { outputPathFor } from './outputPath'
import { writeServiceWorker as pwaWriteServiceWorker } from './pwa'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(appRoot, 'dist')
const viteConfigFile = fileURLToPath(new URL('./vite.config.ts', import.meta.url))
const navCatalogFile = fileURLToPath(new URL('../src/generated/navCatalog.ts', import.meta.url))

plugin({
  name: 'ssg-css-stub',
  setup(builder) {
    builder.onLoad({ filter: /\.css$/ }, () => ({
      contents: 'export default ""',
      loader: 'js',
    }))
  },
})

type ManifestChunk = {
  file: string
  css?: string[]
  isEntry?: boolean
}

type Manifest = Record<string, ManifestChunk>

/**
 * Entries that exist only to pull non-JS resources through Vite. Their JS chunks
 * are empty (or hold a discarded url string) and are deliberately never linked
 * into a page: `styles.entry.ts` carries the css, `assets.entry.ts` carries the
 * static files under `src/assets/`.
 */
const NON_LINKED_ENTRIES = ['styles.entry.ts', 'assets.entry.ts']

/**
 * Manifest keys under this prefix are static assets a page may point at, keyed
 * by their source path relative to the Vite root. See `BuiltAssets` in
 * `ssg/types.ts` for why the emit and the address are two separate steps.
 */
const BUILT_ASSET_PREFIX = 'src/assets/'

/** Entry JS + CSS urls (in `<head>` order) plus the emitted `src/assets/` urls. */
async function readAssets(): Promise<BuildAssets> {
  const manifestPath = join(distDir, '.vite', 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as Manifest

  const scripts: string[] = []
  const styles: string[] = []
  const built: Record<string, string> = {}

  for (const [key, chunk] of Object.entries(manifest)) {
    if (key.startsWith(BUILT_ASSET_PREFIX)) {
      built[key] = `/${chunk.file}`
      continue
    }
    if (!chunk.isEntry) continue
    for (const css of chunk.css ?? []) {
      const href = `/${css}`
      if (!styles.includes(href)) styles.push(href)
    }
    if (NON_LINKED_ENTRIES.some((entry) => key.endsWith(entry))) continue
    scripts.push(`/${chunk.file}`)
  }

  return { scripts, styles, built }
}

// `outputPathFor` (URL -> dist file) lives in `./outputPath` so it can be read
// and tested without executing this orchestrator — importing THIS module runs
// `await main()` and kicks off a full Vite build.

async function writeOutput(relativePath: string, contents: string): Promise<void> {
  const target = join(distDir, relativePath)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, contents, 'utf-8')
}

/**
 * Non-HTML outputs (llms.txt, search-index.json, the JSON API).
 *
 * Dynamic import, like `./routes` above and for the same reason: the endpoint
 * modules reach `src/lib/gameData` and (through `staticPaths`) `component-lib`,
 * so they must be loaded AFTER the css-stub plugin is registered.
 *
 * An endpoint's `outputPath` is written verbatim — `schema/chassis.json` is a
 * file, never a `schema/chassis.json/index.html` directory.
 */
async function writeEndpoints(): Promise<void> {
  const { endpoints } = await import('./endpoints')

  let count = 0
  for (const registration of endpoints) {
    for (const { outputPath, body } of registration.resolve()) {
      await writeOutput(outputPath, body())
      count += 1
    }
  }
  console.log(`[ssg] wrote ${count} endpoint(s)`)
}

/**
 * `sitemap-index.xml` + `sitemap-0.xml`, replacing `@astrojs/sitemap`.
 *
 * `routes` is collected during the render pass above, from the registrations
 * that declare `sitemap: true` — so a page is in the sitemap because it said so
 * at its registration site, not because its URL happened to survive a regex.
 * `ssg/sitemap.ts` re-applies Astro's URL filter on top as a safety net.
 *
 * Dynamic import for the usual reason: it reaches `./render` (and through
 * `src/lib/constants`, the reference package), so it must load AFTER the
 * css-stub plugin is registered.
 */
async function writeSitemap(routes: string[]): Promise<void> {
  const { writeSitemap: write } = await import('./sitemap')
  const count = await write({ routes, distDir })
  console.log(`[ssg] wrote sitemap-index.xml + sitemap-0.xml (${count} url(s))`)
}

/**
 * `registerSW.js` + `sw.js` (workbox `generateSW`) over the FINISHED dist.
 *
 * Static import, unlike `./routes` and `./endpoints`: `ssg/pwa.ts` reaches only
 * `workbox-build` and `node:fs`, never the app module graph, so it cannot pull a
 * stylesheet through the SSR pass and does not need the css-stub plugin.
 */
async function writeServiceWorker(): Promise<void> {
  await pwaWriteServiceWorker(distDir)
}

async function main(): Promise<void> {
  const started = Date.now()

  // BEFORE vite, because the nav island imports the generated module and Vite
  // has to bundle the current one. The file is committed too (so tests and the
  // dev server work without a build); `ssg/__tests__/navCatalog.drift.test.ts`
  // fails if the committed copy and this regeneration disagree.
  const { renderNavCatalogModule } = await import('./genNavCatalog')
  await writeFile(navCatalogFile, await renderNavCatalogModule(), 'utf-8')

  console.log('[ssg] vite build (client)')
  // `vite build` sets process.env.NODE_ENV='production' in THIS process, and
  // that breaks the SSR pass below in a genuinely confusing way: Bun picked its
  // JSX transform at startup (NODE_ENV was unset -> `jsxDEV`), but React's
  // `jsx-dev-runtime` re-resolves at import time and its *production* build is
  // an empty stub — so every component-lib module dies with
  // "jsxDEV_… is not a function". Restore what we found.
  const previousNodeEnv = process.env.NODE_ENV
  await viteBuild({ configFile: viteConfigFile, logLevel: 'warn' })
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = previousNodeEnv

  const assets = await readAssets()
  console.log(
    `[ssg] assets: ${assets.scripts.length} script(s), ${assets.styles.length} style(s), ${Object.keys(assets.built).length} emitted asset(s)`
  )

  // A build that emits pages with no script or no stylesheet is a catastrophe
  // that looks like a success: every page renders, the exit code is 0, and the
  // deploy publishes an unstyled, inert site. Vite changing its manifest shape
  // or an entry being renamed would do exactly that, silently, so refuse.
  if (assets.scripts.length === 0 || assets.styles.length === 0) {
    throw new Error(
      `[ssg] refusing to render: expected at least one script and one stylesheet from the Vite manifest, got ${assets.scripts.length} script(s) and ${assets.styles.length} style(s). The manifest is at dist/.vite/manifest.json; check the entry names in ssg/vite.config.ts.`
    )
  }

  // Dynamic, so the css-stub plugin above is already registered when the SSR
  // module graph (pages -> component-lib -> *.css) is first loaded.
  const { routes } = await import('./routes')

  let count = 0
  const sitemapRoutes: string[] = []
  // `writeOutput` is a bare write: two registrations resolving to the same file
  // silently clobber each other, last one wins, and the page count still looks
  // right. That is a plausible mistake — an over-broad getStaticPaths, or a new
  // route whose pattern collides with an existing one — and the only symptom
  // would be a page quietly serving the wrong content. Refuse instead.
  const written = new Map<string, string>()
  for (const registration of routes) {
    for (const { route, render } of registration.resolve()) {
      const outputPath = outputPathFor(route)
      const previous = written.get(outputPath)
      if (previous !== undefined) {
        throw new Error(
          `[ssg] two routes resolve to the same output file: ${outputPath}\n` +
            `  first:  ${previous}\n  second: ${route}\n` +
            `  Check ssg/routes.ts for overlapping patterns or an over-broad getStaticPaths().`
        )
      }
      written.set(outputPath, route)
      await writeOutput(outputPath, render(assets))
      if (registration.sitemap) sitemapRoutes.push(route)
      count += 1
    }
  }
  console.log(`[ssg] rendered ${count} page(s)`)

  // The same class of silent catastrophe one level up: a registry that resolves
  // to nothing (a bad glob, an exception swallowed inside resolve()) would emit
  // an empty dist and still exit 0, and Netlify would happily publish it. The
  // floor is deliberately low — it is a smoke alarm, not a budget. The parity
  // gate is what actually holds the page COUNT to 1,039.
  if (count === 0) {
    throw new Error('[ssg] refusing to finish: the route registry rendered 0 pages.')
  }

  await writeEndpoints()
  await writeSitemap(sitemapRoutes)
  await writeServiceWorker()

  // `manifest: true` is required — it is how this script learns the hashed
  // entry filenames — but the manifest itself is a BUILD input, not site
  // content. Astro published no equivalent, and leaving it would ship a 33 KB
  // file enumerating every internal chunk to anyone who asks. Everything that
  // reads it has already run by here (readAssets above, and the service worker
  // globs only js/css/woff2/svg, so it was never precached).
  await rm(join(distDir, '.vite'), { recursive: true, force: true })

  console.log(`[ssg] done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

await main()
