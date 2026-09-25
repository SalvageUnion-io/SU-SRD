/**
 * Styling-ownership laws — the `styling` rule set of `tools/check-styling.ts`.
 *
 * The property this locks: **component-lib is the single source of truth for all
 * components and shared styling.** An app is a composition root — it wires the
 * library's components to its own data — not a second design system. When an app
 * grows its own `@theme` tokens, its own orphaned CSS, or generic components that
 * never touch the library, the source-of-truth boundary has already been crossed;
 * the drift just hasn't been named yet. This rule set names it.
 *
 * Why a build step and not a review habit: like the design-token drift, none of
 * these violations fail typecheck. A stray app `@theme` block compiles. Dead CSS
 * compiles. A `pc-*` class referenced but never defined renders unstyled — no
 * error, just a wrong-looking element.
 *
 * The analyses here are structural (cross-file reference graphs, brace-context
 * parsing) rather than per-line regexes, so each rule has its own scan function.
 * Four rules are `zero` (any finding fails); the two #802 migration counts are
 * `ratchet` rules against `tools/styling-baseline.json`.
 *
 * ONE UPWARD REBASELINE of `tailwind-utility-file` is on record, and it wrote no
 * Tailwind. The rule counts FILES, so splitting one Tailwind-carrying file into
 * several raises it by construction. Audits PK-08 and AP-16 (2026-09-25) split
 * `ReferenceEntityCard.tsx` into per-section components and gave each Active
 * Item band its own file: 326 -> 343 files, while the utility TOTAL across every
 * file those commits touched FELL, 773 -> 767 (the split deduplicated repeated
 * class lists). Raised with `--allow-increase`. A split may do this only with
 * that evidence in hand — the utility total over the touched files must not
 * rise — and the new files migrate with their parents' phase of the plan.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Exemption, Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { isExempt, listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'
import { tailwindUtilitiesIn } from '../lib/tailwindClasses'
import { assertCoversWorkspaces } from '../lib/workspaceCoverage'

// ── file gathering ─────────────────────────────────────────────────────────

const APP_DIRS = ['apps/itun/src', 'apps/srd/src'] as const
const DASHBOARD_DIR = 'packages/component-lib/src/styles/dashboard'

/**
 * UI source a Tailwind class could live in. Tests are excluded because they
 * assert on class names rather than style with them; stories are INCLUDED,
 * because a Ladle group is only migrated when none of its files carries a
 * Tailwind class (the plan's per-group exit criterion).
 */
const UI_SOURCE_DIRS = ['packages/component-lib/src', 'apps/itun/src', 'apps/srd/src'] as const

/** The file sets the rules share, gathered once per scan. Repo-relative paths. */
type Corpus = {
  root: string
  appCss: string[]
  appSource: string[]
  /** pc-* usage is checked repo-wide (both apps + the library + tests). */
  allTs: string[]
  uiSource: string[]
  read: (rel: string) => string
}

function corpus(root: string): Corpus {
  const cache = new Map<string, string>()
  return {
    root,
    appCss: listFiles(root, APP_DIRS, ['.css']),
    // `.astro` was in this list until apps/srd moved off Astro.
    appSource: listFiles(root, APP_DIRS, ['.tsx', '.ts']),
    allTs: listFiles(root, ['apps', 'packages'], ['.tsx', '.ts']),
    uiSource: listFiles(root, UI_SOURCE_DIRS, ['.tsx', '.ts']).filter(
      (f) => !/\.test\.tsx?$/.test(f) && !/[\\/]__tests__[\\/]/.test(f)
    ),
    read(rel) {
      let text = cache.get(rel)
      if (text === undefined) {
        text = readFileSync(join(root, rel), 'utf8')
        cache.set(rel, text)
      }
      return text
    },
  }
}

/** Which app a repo-relative path belongs to (for same-app reference checks). */
function appOf(relPath: string): string | null {
  return relPath.match(/^apps\/([^/]+)\//)?.[1] ?? null
}

// ── exemptions ───────────────────────────────────────────────────────────────

/**
 * Sanctioned exceptions. Each entry needs a reason — an exemption without a
 * justification is just a silent hole in the guardrail.
 */
const EXEMPTIONS: Exemption[] = [
  {
    file: 'apps/itun/src/index.css',
    rules: ['app-theme'],
    reason:
      'The one surviving app-local `@theme` block: `--animate-loader-slide`, a genuinely app-only indeterminate-loader animation with a single consumer (GameDataReady). It defines no reserved-namespace design token — only an `--animate-*` keyframe binding — so it is not shared styling the library should own. NOTE this exempts the block from the "no @theme in an app" clause ONLY; the separate reserved-token-definition clause is NOT exempted here, so adding a `--color-*`/`--text-*`/etc. inside this block would still fail.',
  },
]

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

function scanAppTheme(c: Corpus): Finding[] {
  const out: Finding[] = []
  for (const relPath of c.appCss) {
    const css = stripCssComments(c.read(relPath))
    const lines = css.split('\n')
    const mask = printBlockMask(css)
    lines.forEach((text, i) => {
      // (a) an `@theme` block is an app-local token registry — the library owns
      //     the theme. Exempt only the sanctioned loader-animation block.
      if (/@theme\b/.test(text) && !isExempt(EXEMPTIONS, relPath, 'app-theme')) {
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
  // Quoted strings are blanked first (length-preserving is unnecessary — only
  // line numbers are reported). A path in an at-rule prelude is not a
  // selector: `@source not '../src/**/*.stories.tsx';` would otherwise report
  // a dead `.stories` class, and `@import 'x/theme.css'` a `.css` one.
  const clean = stripCssComments(css).replace(/'[^'\n]*'|"[^"\n]*"/g, "''")
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
            const name = m[1]
            if (name !== undefined) out.push({ name, line: i + 1 })
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
        const name = m[1]
        if (name !== undefined) out.push({ name, line: i + 1 })
      }
    }
  })
  return out
}

function scanDeadAppCss(c: Corpus): Finding[] {
  const out: Finding[] = []
  // Concatenate each app's source once for whole-word reference checks.
  const sourceByApp = new Map<string, string>()
  for (const f of c.appSource) {
    const app = appOf(f)
    if (!app) continue
    sourceByApp.set(app, (sourceByApp.get(app) ?? '') + c.read(f))
  }
  for (const relPath of c.appCss) {
    if (isExempt(EXEMPTIONS, relPath, 'dead-app-css')) continue
    const app = appOf(relPath)
    if (!app) continue
    const source = sourceByApp.get(app) ?? ''
    const seen = new Set<string>()
    for (const { name, line } of classSelectorsInCss(c.read(relPath))) {
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

const PC_CSS_FILES = ['DashboardCanvas.css', 'DashboardGrid.css', 'instruments.css'].map(
  (f) => `${DASHBOARD_DIR}/${f}`
)

function scanPcContract(c: Corpus): Finding[] {
  const out: Finding[] = []

  // DEFINED: `.pc-*` class selectors in the three dashboard CSS files (exact).
  const defined = new Map<string, { file: string; line: number }>()
  for (const relPath of PC_CSS_FILES) {
    const css = stripCssComments(c.read(relPath))
    css.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/\.(pc-[a-z0-9-]+)/g)) {
        const name = m[1]
        if (name !== undefined && !defined.has(name))
          defined.set(name, { file: relPath, line: i + 1 })
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
  for (const relPath of c.allTs) {
    stripTsComments(c.read(relPath))
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

function scanUnboundComponents(c: Corpus): Finding[] {
  const out: Finding[] = []
  const componentFiles = listFiles(
    c.root,
    APP_DIRS.map((d) => `${d}/components`),
    ['.tsx']
  ).filter((f) => !/\.(test|stories)\.tsx$/.test(f))
  for (const relPath of componentFiles) {
    const src = c.read(relPath)
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

// ── Rules 5 + 6: the #802 migration ratchets ──────────────────────────────────
//
// The repo runs four styling systems at once — Tailwind utilities, the `.su-*`
// package stylesheet, `theme.css`, and the Dashboard's `.pc-*` scope — and the
// plan (docs/design-system/tailwind-removal.md) ends at one: `tokens.ts` plus
// `index.css`. Until the last phase lands, these two rules make the count of
// the retiring systems a number that can only go DOWN. They are the whole
// enforcement story for "new code does not add to the migration": neither
// system errors when it grows, so without a ratchet the backlog would refill as
// fast as the phases drain it.

function scanTailwindFiles(c: Corpus): Finding[] {
  const out: Finding[] = []
  for (const file of c.uiSource) {
    const found = tailwindUtilitiesIn(c.read(file))
    if (found.length === 0) continue
    out.push({
      file,
      line: 1,
      detail: `${found.length} Tailwind utilit${found.length === 1 ? 'y' : 'ies'} (e.g. ${found.slice(0, 3).join(' ')})`,
    })
  }
  return out
}

/** One violation per distinct `.pc-*` class the Dashboard stylesheets DEFINE. */
function scanPcDefinitions(c: Corpus): Finding[] {
  const seen = new Set<string>()
  const out: Finding[] = []
  for (const relPath of PC_CSS_FILES) {
    stripCssComments(c.read(relPath))
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(/\.(pc-[a-z0-9-]+)/g)) {
          const name = m[1] as string
          if (seen.has(name)) continue
          seen.add(name)
          out.push({ file: relPath, line: i + 1, detail: `.${name}` })
        }
      })
  }
  return out
}

// ── rule table ────────────────────────────────────────────────────────────────

/**
 * The app entry stylesheets — the two files that compose the whole cascade for
 * a shipped app. Named explicitly rather than discovered, because the property
 * being checked is about these files SPECIFICALLY: a partial like `print.css`
 * neither should nor could carry the import.
 */
const APP_ENTRY_CSS = ['apps/itun/src/index.css', 'apps/srd/src/styles/global.css'] as const

/**
 * Both halves of the package-stylesheet wiring, in the two files that own it.
 *
 * WHY A GUARD. This is the highest-consequence silent failure in the Tailwind
 * migration, and it fails in two different directions:
 *
 *   MISSING IMPORT — every component already migrated off Tailwind renders
 *   unstyled in production. The library still compiles, every test still
 *   passes, and Ladle looks perfect because Ladle loads the stylesheet through
 *   its own `ladle.css`. Nothing but a human eye on the real app would notice.
 *
 *   UNLAYERED IMPORT — worse, because it looks like the tidier spelling.
 *   `index.css` is written to be loaded ALONE once Tailwind leaves, so its base
 *   block is unlayered; unlayered CSS beats layered CSS whatever the source
 *   order, and Tailwind v4 puts utilities in `@layer utilities`. Measured on the
 *   real build, a bare `@import` landed `h1,…,h6 { font-size: inherit }` past
 *   the end of the utilities layer, outranking every `text-*` utility and
 *   flattening the type on every heading in the app.
 *
 * Both are invisible to typecheck, lint and the test suite, which is exactly the
 * standard the sibling rules in this file are held to. The layer NAME is not
 * asserted — only that the import carries some `layer(...)` and that the
 * declared order puts it before `utilities` — so renaming `su-base` stays cheap
 * while removing the layering does not.
 */
function scanPackageStylesheetImport(c: Corpus): Finding[] {
  const out: Finding[] = []
  for (const rel of APP_ENTRY_CSS) {
    const css = stripCssComments(c.read(rel))
    const lines = css.split('\n')

    const importLine = lines.findIndex((l) =>
      /@import\s+['"]component-lib\/styles\/index\.css['"]/.test(l)
    )
    if (importLine === -1) {
      out.push({
        file: rel,
        line: 1,
        detail:
          "does not import 'component-lib/styles/index.css' — every component migrated off Tailwind renders unstyled in this app",
      })
      continue
    }

    const line = lines[importLine] ?? ''
    const layerMatch = line.match(/layer\(([a-z0-9-]+)\)/i)
    if (!layerMatch) {
      out.push({
        file: rel,
        line: importLine + 1,
        detail:
          'imports the package stylesheet WITHOUT a cascade layer — unlayered CSS outranks Tailwind utilities, which flattens every heading',
      })
      continue
    }

    const layerName = layerMatch[1] as string
    const orderDecl = css.match(/@layer\s+([a-z0-9,\s-]+);/i)
    const order = orderDecl?.[1]?.split(',').map((n) => n.trim()) ?? []
    if (!order.includes(layerName)) {
      out.push({
        file: rel,
        line: importLine + 1,
        detail: `imports into layer(${layerName}) but no @layer declaration names it — layer order then depends on emission order`,
      })
      continue
    }
    if (order.includes('utilities') && order.indexOf(layerName) > order.indexOf('utilities')) {
      out.push({
        file: rel,
        line: importLine + 1,
        detail: `layer(${layerName}) is declared AFTER 'utilities' — the package base then outranks every Tailwind utility`,
      })
    }
  }
  return out
}

type OwnershipRule = Rule & { scan: (c: Corpus) => Finding[] }

const RULES: OwnershipRule[] = [
  {
    id: 'app-theme',
    mode: 'zero',
    rule: 'source-of-truth §component-lib owns shared styling — no app-local design tokens',
    fix: 'Move the token into packages/component-lib/src/styles/theme.css so both apps share one source. A print-time re-point of an EXISTING lib token belongs inside @media print (already allowed). A truly app-only animation with one consumer gets an EXEMPTIONS entry with a reason.',
    scan: scanAppTheme,
  },
  {
    id: 'dead-app-css',
    mode: 'zero',
    rule: 'source-of-truth §authored CSS must have a consumer — orphaned app CSS is drift',
    fix: 'Delete the unreferenced selector, or wire it up. If it is shared styling, it belongs in a component-lib component, not an app stylesheet.',
    scan: scanDeadAppCss,
  },
  {
    id: 'pc-class-contract',
    mode: 'zero',
    rule: 'source-of-truth §the dashboard class contract is closed and bidirectional',
    fix: 'used-but-undefined: define the class in dashboard/{DashboardCanvas,DashboardGrid,instruments}.css (or fix the className typo in the .tsx). defined-but-unused: delete the dead rule, or reference it. Match the EXACT class name — pc-crawler-focus and pc-crawler-focus-note are different classes.',
    scan: scanPcContract,
  },
  {
    id: 'package-stylesheet-import',
    mode: 'zero',
    rule: 'ruleset §the package stylesheet is the ONE stylesheet a consumer loads, and it must not outrank Tailwind while both are live (#799, epic #802)',
    fix: "Each app entry stylesheet must (a) import 'component-lib/styles/index.css' and (b) import it into a cascade layer declared BEFORE Tailwind's `utilities` — the shape is `@layer theme, base, su-base, components, utilities;` at the top and `@import 'component-lib/styles/index.css' layer(su-base);` beside the theme.css import.",
    scan: scanPackageStylesheetImport,
  },
  {
    id: 'tailwind-utility-file',
    mode: 'ratchet',
    rule: 'tailwind-removal plan §ratchet — the number of UI source files carrying a Tailwind utility only goes down (#802)',
    fix: 'Style the new or edited code with the split rule instead: a style object from `tokens.ts` for static properties, a `.su-*` class in component-lib/src/styles/index.css for anything stateful or responsive. See docs/design-system/tailwind-removal.md. If you REMOVED Tailwind from a file, lower the baseline with --update-baseline.',
    scan: scanTailwindFiles,
  },
  {
    id: 'pc-class-defined',
    mode: 'ratchet',
    rule: 'tailwind-removal plan §ratchet — the Dashboard `.pc-*` scope only shrinks (#802, phase 5)',
    fix: 'Do not add a `.pc-*` class. Dashboard styling that needs a new rule goes into a `.su-*` class in component-lib/src/styles/index.css (phase 5 folds the `.pc-*` scope into it). If you removed one, lower the baseline with --update-baseline.',
    scan: scanPcDefinitions,
  },
]

/** The report-only heuristic — printed as a warning, never gated. */
const REPORT_ONLY_ID = 'app-unbound-component'

// ── preconditions ───────────────────────────────────────────────────────────

function preflight(root: string): void {
  const c = corpus(root)
  /**
   * Catastrophe floors for the file sets. Today: 3 app CSS files, ~510 app
   * source files, ~1,170 repo-wide TS files, ~800 UI source files. Each is set
   * far below the real count — see tools/lib/scanFloor.ts. `appCss` is only 3
   * files, so its floor is necessarily blunt; it still catches the directory
   * list going stale and the set collapsing to zero.
   */
  assertScanFloor('styling ownership (app CSS)', c.appCss.length, 2)
  assertScanFloor('styling ownership (app source)', c.appSource.length, 350)
  assertScanFloor('styling ownership (repo TS)', c.allTs.length, 800)
  assertScanFloor('styling ownership (UI source)', c.uiSource.length, 500)

  /**
   * APP_DIRS is the set of apps whose LOCAL css this rule set audits, and it is
   * a hardcoded list. The gaps are real decisions rather than oversights, so
   * they are written down: this is about an app owning styling it should not
   * own, and a workspace with no stylesheet cannot violate that. If any of
   * these ever grows a `.css` file, the exemption becomes stale and this
   * assertion fails — which is the point. See tools/lib/workspaceCoverage.ts.
   */
  assertCoversWorkspaces('styling ownership', APP_DIRS, {
    'apps/discord-bot': 'ships no stylesheet — it renders Discord embeds, not DOM.',
    'apps/su-assets': 'a Worker that serves image bytes and short error strings; no CSS, no DOM.',
    'packages/observability': 'Sentry wiring only; no components and no stylesheet.',
    'packages/salvageunion-reference': 'data and ORM; no components and no stylesheet.',
    'packages/component-lib':
      'is the OWNER this gate checks apps against, not an app to audit. Its dashboard ' +
      'CSS (src/styles/dashboard/) is read separately via DASHBOARD_DIR.',
  })
}

export const stylingOwnership: RuleSet = {
  id: 'styling',
  label: 'styling ownership',
  rules: RULES,
  exemptionsLive: 'tools/rules/stylingOwnership.ts',
  preflight,
  scan(root) {
    const c = corpus(root)
    const out: Record<string, Finding[]> = {}
    for (const rule of RULES) out[rule.id] = rule.scan(c)
    return out
  },
  advisory: (root) => ({ id: REPORT_ONLY_ID, findings: scanUnboundComponents(corpus(root)) }),
}
