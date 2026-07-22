#!/usr/bin/env bun
/**
 * Styling-ownership guardrails — `bun run check:styling`.
 *
 * The property this locks: **component-lib is the single source of truth for all
 * components and shared styling.** An app is a composition root — it wires the
 * library's components to its own data — not a second design system. When an app
 * grows its own `@theme` tokens, its own orphaned CSS, or generic components that
 * never touch the library, the source-of-truth boundary has already been crossed;
 * the drift just hasn't been named yet. This script names it.
 *
 * Why a build step and not a review habit: like the design-token drift its sibling
 * `check-design-tokens.ts` guards, none of these violations fail typecheck. A
 * stray app `@theme` block compiles. Dead CSS compiles. A `pc-*` class referenced
 * but never defined renders unstyled — no error, just a wrong-looking element.
 * There is no compiler backstop for this class of mistake, so this is it.
 *
 * Mirrors the structure of check-design-tokens.ts exactly: a RULES table (each
 * rule cites the law it enforces and the fix), an EXEMPTIONS table where every
 * entry carries a written reason, and a committed baseline JSON that ratchets
 * DOWNWARD only — new violations fail, the backlog burns down and can never grow.
 * Rebaseline (only ever downward) with: bun run check:styling --update-baseline
 *
 * The analyses here are structural (cross-file reference graphs, brace-context
 * parsing) rather than the per-line regexes of check-design-tokens, so each rule
 * carries a `scan()` instead of a `pattern`. The RULES/EXEMPTIONS/baseline/report
 * shape is otherwise identical.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '..')

// ── file gathering ─────────────────────────────────────────────────────────

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, exts))
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(full)
  }
  return out
}

const rel = (f: string) => relative(ROOT, f)
const read = (f: string) => readFileSync(f, 'utf8')

// Pre-gather the file sets the rules share, once.
const APP_DIRS = ['apps/itun/src', 'apps/srd/src'] as const
const DASHBOARD_DIR = 'packages/component-lib/src/components/dashboard'

const appCssFiles = APP_DIRS.flatMap((d) => walk(join(ROOT, d), ['.css']))
const appSourceFiles = APP_DIRS.flatMap((d) => walk(join(ROOT, d), ['.tsx', '.astro', '.ts']))
// pc-* usage is checked repo-wide (both apps + the library + tests).
const allTsFiles = [
  ...walk(join(ROOT, 'apps'), ['.tsx', '.ts']),
  ...walk(join(ROOT, 'packages'), ['.tsx', '.ts']),
]

/** Which app a repo-relative path belongs to (for same-app reference checks). */
function appOf(relPath: string): string | null {
  const m = relPath.match(/^apps\/([^/]+)\//)
  return m ? m[1] : null
}

// ── rule / exemption / violation types ───────────────────────────────────────

type Violation = { file: string; line: number; detail: string }

type Rule = {
  /** Stable id, used by the exemption list and the baseline. */
  id: string
  /** Which law this enforces — cited back to the author on failure. */
  rule: string
  /** What to do instead. */
  fix: string
  scan: () => Violation[]
}

/**
 * Sanctioned exceptions. Each entry needs a reason — an exemption without a
 * justification is just a silent hole in the guardrail.
 */
const EXEMPTIONS: { file: string; rules: string[]; reason: string }[] = [
  {
    file: 'apps/itun/src/index.css',
    rules: ['app-theme'],
    reason:
      'The one surviving app-local `@theme` block: `--animate-loader-slide`, a genuinely app-only indeterminate-loader animation with a single consumer (GameDataReady). It defines no reserved-namespace design token — only an `--animate-*` keyframe binding — so it is not shared styling the library should own. NOTE this exempts the block from the "no @theme in an app" clause ONLY; the separate reserved-token-definition clause is NOT exempted here, so adding a `--color-*`/`--text-*`/etc. inside this block would still fail.',
  },
]

function isExempt(relPath: string, ruleId: string): boolean {
  return EXEMPTIONS.some((e) => relPath.includes(e.file) && e.rules.includes(ruleId))
}

// ── shared CSS helpers ───────────────────────────────────────────────────────

/** Strip /* … *\/ comments so regexes never match commented-out CSS. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

/**
 * Strip both block and line comments from TS/TSX so class-name extraction never
 * mistakes PROSE for a live reference. Documentation of a REMOVED class — e.g.
 * buttonVariants.ts describing the retired `.pc-railbtn` HUD ghost treatment,
 * in both a JSDoc block and a `//` line comment — must not read as a usage.
 * Line comments are only stripped when `//` follows whitespace or line-start, so
 * `https://…` and `'a//b'` string contents are left intact.
 */
function stripTsComments(src: string): string {
  return stripCssComments(src).replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

/**
 * Walk a CSS file line-by-line tracking brace depth and, per open block, whether
 * it is an `@media print` block. Returns, for each line index, whether that line
 * sits inside an @media print block. Good enough for the simple, hand-authored
 * app stylesheets here (no CSS-in-JS, no exotic nesting).
 */
function printBlockMask(css: string): boolean[] {
  const lines = css.split('\n')
  const stack: boolean[] = []
  const mask: boolean[] = []
  let pendingPrint = false
  for (const line of lines) {
    mask.push(stack.some(Boolean))
    // Detect the start of an @media print at-rule (its `{` may be same line or next).
    if (/@media[^{]*\bprint\b/.test(line)) pendingPrint = true
    for (const ch of line) {
      if (ch === '{') {
        stack.push(pendingPrint)
        pendingPrint = false
      } else if (ch === '}') {
        stack.pop()
      }
    }
  }
  return mask
}

const RESERVED_TOKEN = /^\s*--(?:color|text|tracking|bw|radius|font|shadow)-[\w-]+\s*:/

// ── Rule 1: app-theme ─────────────────────────────────────────────────────────

function scanAppTheme(): Violation[] {
  const out: Violation[] = []
  for (const file of appCssFiles) {
    const relPath = rel(file)
    const css = stripCssComments(read(file))
    const lines = css.split('\n')
    const mask = printBlockMask(css)
    lines.forEach((text, i) => {
      // (a) an `@theme` block is an app-local token registry — the library owns
      //     the theme. Exempt only the sanctioned loader-animation block.
      if (/@theme\b/.test(text) && !isExempt(relPath, 'app-theme')) {
        out.push({ file: relPath, line: i + 1, detail: '@theme block in an app stylesheet' })
      }
      // (b) DEFINING a reserved-namespace token anywhere in an app is forbidden —
      //     EXCEPT re-pointing an existing lib token inside @media print (theme.css
      //     sanctions the white-paper print override). Never exempted by file.
      if (RESERVED_TOKEN.test(text) && !mask[i]) {
        out.push({
          file: relPath,
          line: i + 1,
          detail: `reserved-namespace token defined outside @media print: ${text.trim()}`,
        })
      }
    })
  }
  return out
}

// ── Rule 2: dead-app-css ──────────────────────────────────────────────────────

/** Class tokens that lead a selector in an app stylesheet. Excludes attribute
 *  selectors ([data-*]) and pseudo (::before / :hover) by construction — a `.`
 *  token stops at `:` and `[` is never a `.`. */
function classSelectorsInCss(css: string): { name: string; line: number }[] {
  const clean = stripCssComments(css)
  const lines = clean.split('\n')
  const out: { name: string; line: number }[] = []
  let depth = 0
  lines.forEach((line, i) => {
    // A selector list is the text preceding a `{` at depth 0. Only harvest classes
    // from selector context, never from inside a declaration block.
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      if (ch === '{') {
        if (depth === 0) {
          const selector = line.slice(0, c)
          for (const m of selector.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) {
            out.push({ name: m[1], line: i + 1 })
          }
        }
        depth++
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1)
      }
    }
    // Multi-line selector lists: if we're at depth 0 and there's no brace on this
    // line, the whole line is selector text (e.g. a comma-continued selector).
    if (depth === 0 && !line.includes('{') && !line.includes('}')) {
      for (const m of line.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) {
        out.push({ name: m[1], line: i + 1 })
      }
    }
  })
  return out
}

function scanDeadAppCss(): Violation[] {
  const out: Violation[] = []
  // Concatenate each app's source once for whole-word reference checks.
  const sourceByApp = new Map<string, string>()
  for (const f of appSourceFiles) {
    const app = appOf(rel(f))
    if (!app) continue
    sourceByApp.set(app, (sourceByApp.get(app) ?? '') + read(f))
  }
  for (const file of appCssFiles) {
    const relPath = rel(file)
    if (isExempt(relPath, 'dead-app-css')) continue
    const app = appOf(relPath)
    if (!app) continue
    const source = sourceByApp.get(app) ?? ''
    const seen = new Set<string>()
    for (const { name, line } of classSelectorsInCss(read(file))) {
      if (seen.has(name)) continue
      seen.add(name)
      // Referenced as a whole token anywhere in the same app's source?
      const re = new RegExp(`(^|[^\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w-]|$)`)
      if (!re.test(source)) {
        out.push({
          file: relPath,
          line,
          detail: `.${name} defined but never referenced in app source`,
        })
      }
    }
  }
  return out
}

// ── Rule 3: pc-class-contract ─────────────────────────────────────────────────

const PC_CSS_FILES = ['DashboardCanvas.css', 'DashboardGrid.css', 'instruments.css'].map((f) =>
  join(ROOT, DASHBOARD_DIR, f)
)

function scanPcContract(): Violation[] {
  const out: Violation[] = []

  // DEFINED: `.pc-*` class selectors in the three dashboard CSS files (exact).
  const defined = new Map<string, { file: string; line: number }>()
  for (const file of PC_CSS_FILES) {
    const relPath = rel(file)
    const css = stripCssComments(read(file))
    css.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/\.(pc-[a-z0-9-]+)/g)) {
        if (!defined.has(m[1])) defined.set(m[1], { file: relPath, line: i + 1 })
      }
    })
  }

  // USED: exact `pc-*` tokens appearing in any .tsx/.ts (incl. tests + stories)
  // repo-wide. Exact-token extraction (not prefix matching) is load-bearing:
  // `pc-crawler-focus` and `pc-crawler-focus-note` are DIFFERENT classes, and a
  // prefix match would let the -note usage falsely "cover" the bare class.
  //
  // Two precision guards keep this to genuine className references:
  //  - block comments are stripped, so a JSDoc line documenting a REMOVED class
  //    (buttonVariants.ts describes the retired `.pc-btn`/`.pc-deck-btn`/… HUD
  //    classes) is not mistaken for a live usage.
  //  - a `pc-*` string sitting in a NON-class attribute (`name="pc-deck-currency"`
  //    is a radio-group name, not a class) is skipped — it is not part of the
  //    class contract and must not gate the ratchet.
  const used = new Map<string, { file: string; line: number }>()
  for (const file of allTsFiles) {
    const relPath = rel(file)
    stripTsComments(read(file))
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(/\bpc-[a-z0-9-]+/g)) {
          const before = line.slice(0, m.index)
          // Skip non-class attribute values (form name/id/htmlFor/key).
          if (/\b(?:name|id|htmlFor|key)\s*=\s*["'`{]$/.test(before)) continue
          if (!used.has(m[0])) used.set(m[0], { file: relPath, line: i + 1 })
        }
      })
  }

  // (a) used-but-undefined — a class a component asks for that no stylesheet paints.
  for (const [name, where] of used) {
    if (!defined.has(name)) {
      out.push({
        file: where.file,
        line: where.line,
        detail: `pc class '${name}' used but not defined in {DashboardCanvas,DashboardGrid,instruments}.css`,
      })
    }
  }
  // (b) defined-but-unused — dead dashboard CSS.
  for (const [name, where] of defined) {
    if (!used.has(name)) {
      out.push({
        file: where.file,
        line: where.line,
        detail: `pc class '.${name}' defined but never referenced`,
      })
    }
  }
  return out
}

// ── Rule 4: app-unbound-component (REPORT-ONLY) ───────────────────────────────
//
// Heuristic hunt for generic components living in an app that should live in the
// library: a component .tsx under apps/*/src/components/** that renders JSX yet
// imports NEITHER component-lib NOR any binding module (a store, lib/db, a schema,
// the router, or the reference package). Something generic enough to touch none of
// those is a candidate for the shared library.
//
// This is WARN-ONLY and deliberately kept out of the pass/fail ratchet. It WILL
// false-positive (a pure presentational leaf that legitimately lives in an app,
// a component that takes everything by prop). It graduates to a hard, baselined
// rule only once its output is curated and trustworthy. And be honest about its
// ceiling: SEMANTIC duplication — a component that imports Button but re-builds a
// card out of raw <div>s — is invisible to an import-graph heuristic and stays a
// human-review concern forever. This finds structural orphans, not design ones.

const BINDING_IMPORT =
  /from\s+['"](?:component-lib|salvageunion-reference|@tanstack\/react-router)['"]|from\s+['"][^'"]*(?:stores?\/|lib\/db|lib\/rules|\/schemas?|routeTree|\/router)[^'"]*['"]/

function scanUnboundComponents(): Violation[] {
  const out: Violation[] = []
  const componentFiles = APP_DIRS.flatMap((d) =>
    walk(join(ROOT, d, 'components'), ['.tsx'])
  ).filter((f) => !/\.(test|stories)\.tsx$/.test(f))
  for (const file of componentFiles) {
    const relPath = rel(file)
    const src = read(file)
    const rendersJsx = /return\s*[(<]/.test(src) && /<[A-Za-z]/.test(src)
    if (!rendersJsx) continue
    if (BINDING_IMPORT.test(src)) continue
    out.push({
      file: relPath,
      line: 1,
      detail: 'component renders JSX but imports no library/binding module',
    })
  }
  return out
}

// ── rule table ────────────────────────────────────────────────────────────────

const RULES: Rule[] = [
  {
    id: 'app-theme',
    rule: 'source-of-truth §component-lib owns shared styling — no app-local design tokens',
    fix: 'Move the token into packages/component-lib/src/styles/theme.css so both apps share one source. A print-time re-point of an EXISTING lib token belongs inside @media print (already allowed). A truly app-only animation with one consumer gets an EXEMPTIONS entry with a reason.',
    scan: scanAppTheme,
  },
  {
    id: 'dead-app-css',
    rule: 'source-of-truth §authored CSS must have a consumer — orphaned app CSS is drift',
    fix: 'Delete the unreferenced selector, or wire it up. If it is shared styling, it belongs in a component-lib component, not an app stylesheet.',
    scan: scanDeadAppCss,
  },
  {
    id: 'pc-class-contract',
    rule: 'source-of-truth §the dashboard class contract is closed and bidirectional',
    fix: 'used-but-undefined: define the class in dashboard/{DashboardCanvas,DashboardGrid,instruments}.css (or fix the className typo in the .tsx). defined-but-unused: delete the dead rule, or reference it. Match the EXACT class name — pc-crawler-focus and pc-crawler-focus-note are different classes.',
    scan: scanPcContract,
  },
]

// The report-only rule is run separately — it never touches pass/fail.
const REPORT_ONLY: Rule = {
  id: 'app-unbound-component',
  rule: 'source-of-truth §generic components belong in the library (HEURISTIC, report-only)',
  fix: 'If the component is generic (no store / db / schema / router / reference coupling), move it to packages/component-lib. If it is legitimately app-specific, ignore — this is a heuristic and will false-positive.',
  scan: scanUnboundComponents,
}

// ── ratchet ───────────────────────────────────────────────────────────────────

const BASELINE_PATH = join(import.meta.dir, 'styling-ownership-baseline.json')
type Baseline = Record<string, number>

const results = new Map<string, Violation[]>()
for (const rule of RULES) results.set(rule.id, rule.scan())

const counts: Baseline = {}
for (const rule of RULES) counts[rule.id] = (results.get(rule.id) ?? []).length

// --report: print every current violation, grouped. Diagnostic; never gates.
if (process.argv.includes('--report')) {
  for (const rule of RULES) {
    const list = results.get(rule.id) ?? []
    console.log(`\n── ${rule.id} (${list.length})`)
    for (const v of list) console.log(`   ${v.file}:${v.line}  ${v.detail}`)
  }
  const warn = REPORT_ONLY.scan()
  console.log(`\n── ${REPORT_ONLY.id} [report-only] (${warn.length})`)
  for (const v of warn) console.log(`   ${v.file}:${v.line}  ${v.detail}`)
  process.exit(0)
}

if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`)
  console.log('✓ baseline written:', rel(BASELINE_PATH))
  for (const [id, n] of Object.entries(counts)) console.log(`   ${id}: ${n}`)
  process.exit(0)
}

let baseline: Baseline = {}
try {
  baseline = JSON.parse(read(BASELINE_PATH))
} catch {
  console.error(
    `No baseline at ${rel(BASELINE_PATH)}. Create it with: bun run check:styling --update-baseline`
  )
  process.exit(1)
}

const regressions: string[] = []
const improvements: string[] = []
for (const rule of RULES) {
  const now = counts[rule.id]
  const was = baseline[rule.id] ?? 0
  if (now > was) regressions.push(rule.id)
  else if (now < was) improvements.push(`${rule.id}: ${was} → ${now}`)
}

// The report-only rule always prints its findings as a warning, but never gates.
const warnings = REPORT_ONLY.scan()

if (regressions.length === 0) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log(`✓ styling ownership: no new violations (${total} known, burning down)`)
  if (improvements.length > 0) {
    console.log('  improved — lower the baseline with `bun run check:styling --update-baseline`:')
    for (const i of improvements) console.log(`    ${i}`)
  }
  if (warnings.length > 0) {
    console.log(
      `\n  ⚠ ${REPORT_ONLY.id} [report-only, not enforced]: ${warnings.length} candidate(s) — generic components that may belong in component-lib:`
    )
    for (const v of warnings.slice(0, 25)) console.log(`    ${v.file}`)
    if (warnings.length > 25) console.log(`    … and ${warnings.length - 25} more`)
  }
  process.exit(0)
}

console.error('\n✗ NEW styling-ownership violations introduced\n')
for (const ruleId of regressions) {
  const list = results.get(ruleId) ?? []
  const rule = RULES.find((r) => r.id === ruleId)
  if (!rule) continue
  const was = baseline[ruleId] ?? 0
  console.error(`── ${ruleId} — ${rule.rule}`)
  console.error(`   ${was} allowed, ${list.length} found (+${list.length - was})`)
  console.error(`   fix: ${rule.fix}\n`)
  for (const v of list.slice(0, 25)) console.error(`   ${v.file}:${v.line}  ${v.detail}`)
  if (list.length > 25) console.error(`   … and ${list.length - 25} more`)
  console.error('')
}
console.error('A genuinely-correct case needs either an EXEMPTIONS entry in')
console.error('tools/check-styling-ownership.ts (with a reason) or the violation removed.\n')
process.exit(1)
