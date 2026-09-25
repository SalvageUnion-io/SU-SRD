/**
 * Route files export `Route` and nothing else (audit AP-11).
 *
 * `vite.config.ts` turns on TanStack Router's `autoCodeSplitting`, which moves
 * each route's component into its own lazily loaded chunk. It can only do that
 * when the component is private to the route file: any other export (a page
 * body "exported for testing", a helper) keeps the file's component graph in
 * the eagerly imported route definition, and so in the ENTRY chunk that every
 * route downloads.
 *
 * That is not hypothetical. `/s/$id` and `/p/$kind/$appId` each exported a
 * page body for their tests, and between them pinned `SnapshotSheet`,
 * `PublicSheet` and — through them — the whole live-sheet tree, the dashboard
 * chooser and the QR encoder into the entry, where `index.html` modulepreloaded
 * them on every route including the share links themselves. The page bodies
 * now live under `components/`, and this test keeps the next one out.
 *
 * Put a testable page body in a component module and import it from both the
 * route and the test.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const routesDir = join(import.meta.dir, '..')

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === '__tests__') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...routeFiles(full))
    else if (/\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

/** Names a module exports at runtime — `export type` is erased and ignored. */
function valueExports(source: string): string[] {
  const names: string[] = []
  for (const m of source.matchAll(
    /^export\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm
  )) {
    names.push(m[1] as string)
  }
  if (/^export\s+default\b/m.test(source)) names.push('default')
  for (const m of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of (m[1] as string).split(',')) {
      const name = part.trim()
      if (name && !name.startsWith('type ')) names.push(name)
    }
  }
  return [...new Set(names)]
}

describe('route modules', () => {
  const files = routeFiles(routesDir)

  test('the scan found the route tree', () => {
    expect(files.length).toBeGreaterThan(15)
  })

  test.each(files.map((f) => [relative(routesDir, f), f]))(
    '%s exports only Route',
    (_name, file) => {
      const exports = valueExports(readFileSync(file, 'utf8'))
      expect(exports).toEqual(['Route'])
    }
  )
})
