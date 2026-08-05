/**
 * build — the SSG orchestrator.
 *
 *   1. `vite build` (client only): the islands entry + the css entry, with a
 *      manifest.
 *   2. read `dist/.vite/manifest.json` -> entry JS + CSS urls.
 *   3. enumerate `ssg/routes.ts` and render each route.
 *   4. write endpoints, sitemap, registerSW.js.        (TODO — later phase)
 *   5. workbox generateSW.                             (TODO — later phase)
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
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build as viteBuild } from 'vite'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(appRoot, 'dist')
const viteConfigFile = fileURLToPath(new URL('./vite.config.ts', import.meta.url))

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

/** Entry JS + CSS urls, in the order they should appear in `<head>`. */
async function readAssets(): Promise<{ scripts: string[]; styles: string[] }> {
  const manifestPath = join(distDir, '.vite', 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as Manifest

  const scripts: string[] = []
  const styles: string[] = []

  for (const [key, chunk] of Object.entries(manifest)) {
    if (!chunk.isEntry) continue
    for (const css of chunk.css ?? []) {
      const href = `/${css}`
      if (!styles.includes(href)) styles.push(href)
    }
    // The styles entry exists only to pull css through Vite; its JS chunk is
    // empty and is deliberately not linked.
    if (key.endsWith('styles.entry.ts')) continue
    scripts.push(`/${chunk.file}`)
  }

  return { scripts, styles }
}

/**
 * URL -> dist file. Must match Astro exactly (see the table in DESIGN.md):
 * `/` -> `index.html`, `/404` -> `404.html` (special-cased, NOT a directory),
 * everything else -> `<route>/index.html`.
 */
export function outputPathFor(route: string): string {
  if (route === '/') return 'index.html'
  if (route === '/404') return '404.html'
  const trimmed = route.replace(/^\/+|\/+$/g, '')
  return join(trimmed, 'index.html')
}

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

// TODO(migration): sitemap-index.xml + sitemap-0.xml, reproducing Astro's
// filter (exclude /image, /greembeem, .og.png, /og-card).
async function writeSitemap(): Promise<void> {}

// TODO(migration): workbox generateSW over the finished dist + registerSW.js.
async function writeServiceWorker(): Promise<void> {}

async function main(): Promise<void> {
  const started = Date.now()

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
  console.log(`[ssg] assets: ${assets.scripts.length} script(s), ${assets.styles.length} style(s)`)

  // Dynamic, so the css-stub plugin above is already registered when the SSR
  // module graph (pages -> component-lib -> *.css) is first loaded.
  const { routes } = await import('./routes')

  let count = 0
  for (const registration of routes) {
    for (const { route, render } of registration.resolve()) {
      await writeOutput(outputPathFor(route), render(assets))
      count += 1
    }
  }
  console.log(`[ssg] rendered ${count} page(s)`)

  await writeEndpoints()
  await writeSitemap()
  await writeServiceWorker()

  console.log(`[ssg] done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

await main()
