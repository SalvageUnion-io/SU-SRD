/**
 * outputPath — URL -> dist file, the one rule the whole emit depends on.
 *
 * Split out of `ssg/build.ts` so it can be read (and tested) without executing
 * the orchestrator: `build.ts` runs `await main()` at module scope, so importing
 * it to reach this function would kick off a full Vite build.
 *
 * It has no `.css` in its module graph (only `node:path`), so unlike everything
 * else `build.ts` reaches, importing it at the top is safe.
 */

import { join } from 'node:path'

/**
 * Must match Astro exactly (see the table in `ssg/DESIGN.md`):
 * `/` -> `index.html`, `/404` -> `404.html` (special-cased, NOT a directory),
 * everything else -> `<route>/index.html`.
 *
 * This is for **HTML routes only**. Endpoints (`schema/chassis.json`,
 * `llms.txt`) never come through here — their `pattern` already IS a dist path
 * and is written verbatim, which is what keeps a dotted route a file instead of
 * a `schema/chassis.json/index.html` directory. See `ssg/endpoints.ts`.
 */
export function outputPathFor(route: string): string {
  if (route === '/') return 'index.html'
  if (route === '/404') return '404.html'
  const trimmed = route.replace(/^\/+|\/+$/g, '')
  return join(trimmed, 'index.html')
}
