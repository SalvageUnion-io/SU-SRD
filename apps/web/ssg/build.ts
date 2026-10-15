/**
 * build — the site's one build, into one `dist/`.
 *
 *   1. regenerate the nav catalog (`ssg/genNavCatalog.ts`), which the nav
 *      island imports, so the pass bundles the current one. The file is
 *      committed too (tests and the dev server work without a build);
 *      `ssg/__tests__/navCatalog.drift.test.ts` fails if the two disagree.
 *   2. the one Vite pass (`vite.config.ts`, in a child process: `ssg/bundle.ts`
 *      says why). It bundles every client entry and the builder's shell,
 *      copies `public/`, renders every page (`ssg/prerender.ts`, its first
 *      `closeBundle` step) and, last, generates the service worker over the
 *      finished site.
 */

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { renderNavCatalogModule } from './genNavCatalog'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const bundleFile = fileURLToPath(new URL('./bundle.ts', import.meta.url))
const navCatalogFile = fileURLToPath(new URL('../src/generated/navCatalog.ts', import.meta.url))

const started = Date.now()
await writeFile(navCatalogFile, await renderNavCatalogModule(), 'utf-8')

// biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
console.log('[build] vite build: the bundle, every page, the service worker')
const bundle = Bun.spawn([process.execPath, bundleFile], {
  cwd: appRoot,
  stdout: 'inherit',
  stderr: 'inherit',
})
if ((await bundle.exited) !== 0) throw new Error('[build] vite build failed (above).')

// biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
console.log(`[build] done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
