#!/usr/bin/env bun
/**
 * srd's stylesheet entry rule — `bun run check:srd-css`.
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
 * `check-styling-ownership.ts` does not cover this either: its `dead-app-css`
 * rule looks for class selectors that are *unreferenced*, so a stylesheet whose
 * classes ARE referenced looks healthy while never being served.
 *
 * ## What this asserts
 *
 * Exactly one module in `apps/srd` may import a stylesheet, and it is
 * `src/runtime/styles.entry.ts`. Scoped to srd's own source: `component-lib`
 * components legitimately import their own css and are reached through Vite for
 * the client bundle, which is the case the stub plugin exists to make
 * deterministic on the SSR side.
 *
 * Exit codes: 0 — only the entry imports css; 1 — some other module does, or
 * the entry stopped importing any (which would mean the site ships unstyled).
 *
 * Usage: bun run check:srd-css
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { assertScanFloor } from './lib/scanFloor'

const ROOT = join(import.meta.dir, '..')
const SRD = join(ROOT, 'apps/srd')
const LABEL = 'check:srd-css'

/** The one module allowed to import a stylesheet, repo-relative. */
const ENTRY = 'apps/srd/src/runtime/styles.entry.ts'

const SCAN_DIRS = ['ssg', 'src']
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

/** `import './x.css'`, `import 'pkg/y.css'`, and the `await import()` form. */
const CSS_IMPORT =
  /(?:^|\n)\s*import\s+(?:[^'"\n]*\s+from\s+)?['"]([^'"]+\.css)['"]|import\(\s*['"]([^'"]+\.css)['"]\s*\)/g

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      out.push(...walk(path))
    } else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      out.push(path)
    }
  }
  return out
}

const files = SCAN_DIRS.flatMap((dir) => walk(join(SRD, dir)))
assertScanFloor(`${LABEL} (srd source files)`, files.length, 65)

const offenders: string[] = []
let entryImports = 0

for (const file of files) {
  const rel = relative(ROOT, file)
  const source = readFileSync(file, 'utf-8')
  for (const match of source.matchAll(CSS_IMPORT)) {
    const specifier = match[1] ?? match[2]
    if (rel === ENTRY) {
      entryImports += 1
      continue
    }
    offenders.push(`${rel} imports '${specifier}'`)
  }
}

if (offenders.length > 0) {
  console.error(`\n✗ ${LABEL}: ${offenders.length} stylesheet import(s) outside the entry.\n`)
  for (const offender of offenders) console.error(`  • ${offender}`)
  console.error(
    `\n  Only ${ENTRY} may import a stylesheet.\n\n` +
      '  This does NOT break the build — that is the problem. The SSR pass stubs\n' +
      '  `.css` to an empty module, and the client bundle is fed only from the entry,\n' +
      '  so an import anywhere else means the authored rules (selectors, keyframes,\n' +
      '  @layer blocks) never ship. Green build, green typecheck, unchanged snapshot.\n\n' +
      '  Move the import into the entry, or make the styles Tailwind utilities, which\n' +
      '  are emitted from class-name scanning rather than from an import.\n'
  )
  process.exit(1)
}

if (entryImports === 0) {
  console.error(
    `\n✗ ${LABEL}: ${ENTRY} imports no stylesheet at all.\n\n` +
      '  That is not "clean", it is the site shipping unstyled. Either the entry was\n' +
      '  emptied, or this check is looking at the wrong file after a rename.\n'
  )
  process.exit(1)
}

console.log(
  `✓ srd css ownership: ${entryImports} stylesheet import(s), all in ${ENTRY} ` +
    `(${files.length} source files checked)`
)
