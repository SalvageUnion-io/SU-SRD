/**
 * srd's stylesheet entry rule — the `srd-css` rule set of `tools/check-styling.ts`.
 *
 * `apps/web/ssg/DESIGN.md` states this as **hard rule 1**: all css is imported from
 * `src/runtime/styles.entry.ts`, which is a client-bundle entry and nothing
 * else, and `ssg/**`, `src/pages/**`, `src/layouts/BaseLayout.tsx` and
 * `src/runtime/Island.tsx` must stay stylesheet-free.
 *
 * ## The rule was enforced by nothing, in either direction
 *
 * `apps/web/CLAUDE.md` and `ssg/DESIGN.md` once said a stray `import './x.css'` in the SSR
 * graph **breaks the build**. It does not. Measured under this repo's Bun: a
 * `.css` import in an SSR module resolves and returns an object, exit 0 —
 * including a package import, and including a file with an unresolvable
 * `@import`. There was never a build failure to rely on.
 *
 * `ssg/build.ts` installs a `ssg-css-stub` plugin that resolves `.css` to an
 * empty module during the SSR pass. That plugin is not what removed the
 * failure; it made an already-silent behaviour deterministic, and its own
 * comment says so.
 *
 * So the actual risk is narrow and real: a `.css` import added to a **page or
 * SSR-only module** never reaches Vite, because the client bundle is fed only
 * from `styles.entry.ts`. Its authored rules — hand-written selectors,
 * keyframes, `@layer` blocks — simply never ship. The build is green, typecheck
 * is green, and nothing anywhere reports it.
 *
 * The `styling` rule set does not cover this either: its `dead-app-css`
 * rule looks for class selectors that are *unreferenced*, so a stylesheet whose
 * classes ARE referenced looks healthy while never being served.
 *
 * ## What this asserts
 *
 * 1. Exactly one module a static page reaches may import a stylesheet, and
 *    it is `src/runtime/styles.entry.ts`. "Reaches" is the relative-import
 *    graph from srd's own trees (`ssg/`, `src/pages/`, `src/endpoints/`,
 *    `src/layouts/`, `src/runtime/`), so a component a page renders is held
 *    to it too. A component-side `import './x.css'` on that graph rides into
 *    every page's bundle: that is how srd bundled, and its service worker
 *    precached, the dashboard's 20 KB of rules no page can use.
 * 2. A module only the builder reaches (its routes and the components they
 *    alone render) imports its own stylesheet: Vite code-splits it with the
 *    route, and `stylingOwnership` owns it.
 *
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

/** The one module allowed to import a stylesheet, repo-relative. */
export const SRD_CSS_ENTRY = 'apps/web/src/runtime/styles.entry.ts'

/** srd's own trees: every file in them is a root of the static-page graph. */
const SRD_ROOTS = ['ssg', 'src/pages', 'src/endpoints', 'src/layouts', 'src/runtime'].map(
  (d) => `apps/web/${d}`
)
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

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
  const seen = new Set(listFiles(root, SRD_ROOTS, EXTENSIONS).filter((rel) => !isTest(rel)))
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
      'This does NOT break the build — that is the problem: the SSR pass stubs `.css` to an ' +
      'empty module and the client bundle is fed only from the entry, so an import anywhere ' +
      'else means its rules never ship. If the entry itself imports nothing, the site ships unstyled.',
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
