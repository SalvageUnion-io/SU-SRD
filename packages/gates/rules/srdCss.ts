/**
 * srd's stylesheet entry rule — the `srd-css` rule set of `tools/check-rule-sets.ts`.
 *
 * The reference site's pages link one stylesheet of their own,
 * `src/styles/global.css`, imported by the one document shell
 * (`astro/layouts/Page.astro`), beside the base stylesheet both apps share.
 * Astro links every stylesheet a page's module graph imports, so a
 * component-side `import './x.css'` anywhere on that graph rides into the
 * pages that reach it: that is how the reference site once bundled, and its
 * service worker precached, the dashboard's 20 KB of rules no page can use.
 * Nothing else reports it: the build and typecheck stay green, and the
 * `styling` rule set's `dead-app-css` looks only for *unreferenced* classes.
 *
 * ## What this asserts
 *
 * 1. Exactly one module a static page reaches may import a stylesheet, and
 *    it is `astro/layouts/Page.astro`. "Reaches" is the relative-import
 *    graph from the reference site's own trees (`astro/` but its build tools
 *    and the app's shell page, `src/reference/pages/`, `src/reference/endpoints/`,
 *    `src/reference/layouts/`, `src/runtime/`), so a component a page renders is held
 *    to it too.
 * 2. A module only the builder reaches (its routes and the components they
 *    alone render) imports its own stylesheet: Vite code-splits it with the
 *    route, and `stylingOwnership` owns it.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

/** The one module allowed to import a stylesheet, repo-relative. */
export const SRD_CSS_ENTRY = 'apps/web/astro/layouts/Page.astro'

/** The reference site's own trees: every file in them is a root of the static-page graph. */
const SRD_ROOTS = [
  'astro/layouts',
  'astro/lib',
  'astro/pages',
  'src/reference/pages',
  'src/reference/endpoints',
  'src/reference/layouts',
  'src/runtime',
].map((d) => `apps/web/${d}`)
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.astro']

/** The app's shell page: it imports the app (`src/main.tsx`), which the builder owns. */
const APP_SHELL = 'apps/web/astro/pages/build/'

/** `import './x.css'`, `import 'pkg/y.css'`, and the `await import()` form. */
const CSS_IMPORT =
  /(?:^|\n)\s*import\s+(?:[^'"\n]*\s+from\s+)?['"]([^'"]+\.css)['"]|import\(\s*['"]([^'"]+\.css)['"]\s*\)/g

/** Every relative module specifier: static imports, re-exports and `import()`. */
const RELATIVE_IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g

/** Tests never reach a page. */
const isTest = (rel: string): boolean =>
  rel.includes('/__tests__/') || /\.(test|spec)\.[cm]?tsx?$/.test(rel)

function resolveRelative(root: string, from: string, spec: string): string | null {
  const base = join(dirname(from), spec)
  for (const candidate of [
    base,
    ...EXTENSIONS.flatMap((e) => [base + e, join(base, `index${e}`)]),
  ]) {
    if (EXTENSIONS.some((e) => candidate.endsWith(e)) && existsSync(join(root, candidate))) {
      return candidate
    }
  }
  return null
}

/** Every non-test module a static page reaches, repo-relative. */
function srdReach(root: string): string[] {
  const seen = new Set(
    listFiles(root, SRD_ROOTS, EXTENSIONS).filter(
      (rel) => !isTest(rel) && !rel.startsWith(APP_SHELL)
    )
  )
  const queue = [...seen]
  for (let rel = queue.pop(); rel !== undefined; rel = queue.pop()) {
    for (const m of readFileSync(join(root, rel), 'utf8').matchAll(RELATIVE_IMPORT)) {
      const next = resolveRelative(root, rel, m[1] ?? '')
      if (next === null || seen.has(next) || isTest(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return [...seen].sort()
}

function cssImports(source: string): string[] {
  return [...source.matchAll(CSS_IMPORT)].map((m) => m[1] ?? m[2] ?? '')
}

const RULES: Rule[] = [
  {
    id: 'srd-css-entry',
    mode: 'zero',
    rule: 'apps/web hard rule 1 — every stylesheet a static page reaches is imported from the one client entry',
    fix:
      `Move the import into ${SRD_CSS_ENTRY}, or keep the module off the static-page graph. ` +
      'This does NOT break the build: Astro links the stylesheet on every page that reaches the ' +
      'import, so its rules ride into pages that never use them. If the entry itself imports ' +
      'nothing, the site ships unstyled.',
  },
]

export const srdCss: RuleSet = {
  id: 'srd-css',
  label: 'srd css ownership',
  rules: RULES,
  exemptionsLive: 'packages/gates/rules/srdCss.ts',
  preflight(root) {
    assertScanFloor('srd-css (modules a static page reaches)', srdReach(root).length, 165)
  },
  scan(root) {
    const entry: Finding[] = []
    let entryImports = 0
    for (const rel of srdReach(root)) {
      const imports = cssImports(readFileSync(join(root, rel), 'utf8'))
      if (rel === SRD_CSS_ENTRY) {
        entryImports += imports.length
        continue
      }
      for (const spec of imports) entry.push({ file: rel, line: 1, detail: `imports '${spec}'` })
    }
    if (entryImports === 0) {
      entry.push({
        file: SRD_CSS_ENTRY,
        line: 1,
        detail: 'imports no stylesheet at all — the site would ship unstyled (or the entry moved)',
      })
    }
    return { 'srd-css-entry': entry }
  },
  summary: (root) => `${srdReach(root).length} modules a static page reaches`,
}
