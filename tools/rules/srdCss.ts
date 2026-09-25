/**
 * srd's stylesheet entry rule — the `srd-css` rule set of `tools/check-styling.ts`.
 *
 * `apps/srd/CLAUDE.md` states this as **hard rule 1**: all css is imported from
 * `src/runtime/styles.entry.ts`, which is a client-bundle entry and nothing
 * else, and `ssg/**`, `src/pages/**`, `src/layouts/BaseLayout.tsx` and
 * `src/runtime/Island.tsx` must stay stylesheet-free.
 *
 * ## The rule was enforced by nothing, in either direction
 *
 * Both that file and `ssg/DESIGN.md` say a stray `import './x.css'` in the SSR
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
 * is green, and the output snapshot digests `<main>` TEXT and meta tags, not
 * CSS. Nothing anywhere reports it.
 *
 * The `styling` rule set does not cover this either: its `dead-app-css`
 * rule looks for class selectors that are *unreferenced*, so a stylesheet whose
 * classes ARE referenced looks healthy while never being served.
 *
 * ## What this asserts
 *
 * 1. Exactly one module in `apps/srd` may import a stylesheet, and it is
 *    `src/runtime/styles.entry.ts`.
 * 2. No **shipping** `component-lib` module may import a stylesheet (stories,
 *    tests and the Ladle-only `src/stories/` tree are exempt). A component-side
 *    `import './x.css'` rides the barrel into every consumer: that is how srd
 *    bundled — and its service worker precached — the dashboard's 20 KB of
 *    `.pc-*` rules that no srd page can use (audit PK-01). A component's
 *    stylesheet is a package EXPORT (`component-lib/styles/*.css`) that the app
 *    which renders the component imports.
 *
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

/** The one module allowed to import a stylesheet, repo-relative. */
export const SRD_CSS_ENTRY = 'apps/srd/src/runtime/styles.entry.ts'

const SRD_DIRS = ['apps/srd/ssg', 'apps/srd/src']
const LIB_DIRS = ['packages/component-lib/src']
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

/** `import './x.css'`, `import 'pkg/y.css'`, and the `await import()` form. */
const CSS_IMPORT =
  /(?:^|\n)\s*import\s+(?:[^'"\n]*\s+from\s+)?['"]([^'"]+\.css)['"]|import\(\s*['"]([^'"]+\.css)['"]\s*\)/g

/** Stories, tests and the Ladle-only `src/stories/` tree never reach a consumer. */
const isLibExempt = (rel: string): boolean =>
  rel.includes('/__tests__/') ||
  rel.startsWith('packages/component-lib/src/stories/') ||
  /\.(stories|test|spec)\.[cm]?tsx?$/.test(rel)

const srdFiles = (root: string) => listFiles(root, SRD_DIRS, EXTENSIONS)
const libFiles = (root: string) =>
  listFiles(root, LIB_DIRS, EXTENSIONS).filter((rel) => !isLibExempt(rel))

function cssImports(source: string): string[] {
  return [...source.matchAll(CSS_IMPORT)].map((m) => m[1] ?? m[2] ?? '')
}

const RULES: Rule[] = [
  {
    id: 'srd-css-entry',
    mode: 'zero',
    rule: 'apps/srd hard rule 1 — every stylesheet is imported from the one client entry',
    fix:
      `Move the import into ${SRD_CSS_ENTRY}. This does NOT break the build — that is the ` +
      'problem: the SSR pass stubs `.css` to an empty module and the client bundle is fed ' +
      'only from the entry, so an import anywhere else means its rules never ship. If the ' +
      'entry itself imports nothing, the site ships unstyled.',
  },
  {
    id: 'lib-css-import',
    mode: 'zero',
    rule: 'component-lib ships no side-effect stylesheet import (audit PK-01)',
    fix:
      'Export the stylesheet instead (`component-lib/styles/<name>.css` in the package ' +
      '`exports`) and import it from the app that renders the component. A component-side ' +
      'import rides the barrel into EVERY consumer — srd shipped the whole dashboard ' +
      'stylesheet this way.',
  },
]

export const srdCss: RuleSet = {
  id: 'srd-css',
  label: 'srd css ownership',
  rules: RULES,
  exemptionsLive: 'tools/rules/srdCss.ts',
  preflight(root) {
    assertScanFloor('srd-css (srd source files)', srdFiles(root).length, 65)
    assertScanFloor('srd-css (component-lib source files)', libFiles(root).length, 100)
  },
  scan(root) {
    const entry: Finding[] = []
    let entryImports = 0
    for (const rel of srdFiles(root)) {
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
    const lib: Finding[] = []
    for (const rel of libFiles(root)) {
      for (const spec of cssImports(readFileSync(join(root, rel), 'utf8'))) {
        lib.push({ file: rel, line: 1, detail: `imports '${spec}'` })
      }
    }
    return { 'srd-css-entry': entry, 'lib-css-import': lib }
  },
  summary: (root) => `${srdFiles(root).length} srd + ${libFiles(root).length} component-lib files`,
}
