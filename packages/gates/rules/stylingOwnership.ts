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
 * compiles. A Dashboard `su-dash-*` class referenced but never defined renders
 * unstyled — no error, just a wrong-looking element.
 *
 * The analyses here are structural (cross-file reference graphs, brace-context
 * parsing) rather than per-line regexes, so each rule has its own scan function.
 * Every rule is `zero` (any finding fails) but `style-object-annotation`, a
 * ratchet burning down the second spelling of a style object.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Exemption, Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { isExempt, listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'
import { assertCoversWorkspaces } from '../lib/workspaceCoverage'

// ── file gathering ─────────────────────────────────────────────────────────

const APP_DIRS = ['apps/itun/src', 'apps/srd/src', 'apps/catalog/src'] as const
const DASHBOARD_DIR = 'apps/itun/src/styles/dashboard'

/** The file sets the rules share, gathered once per scan. Repo-relative paths. */
type Corpus = {
  root: string
  appCss: string[]
  appSource: string[]
  /** su-dash-* usage is checked repo-wide (both apps + the library + tests). */
  allTs: string[]
  read: (rel: string) => string
}

function corpus(root: string): Corpus {
  const cache = new Map<string, string>()
  return {
    root,
    appCss: listFiles(root, APP_DIRS, ['.css']),
    appSource: listFiles(root, APP_DIRS, ['.tsx', '.ts']),
    // Not `packages/gates`: its rule sets and their fixtures name the classes
    // they check, and would count as usages.
    allTs: listFiles(root, ['apps', 'packages'], ['.tsx', '.ts']).filter(
      (rel) => !rel.startsWith('packages/gates/')
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
    file: 'apps/itun/src/styles/libHandback.css',
    rules: ['dead-app-css'],
    reason:
      "Its selectors are component-lib's own classes, referenced in component-lib source rather than ITUN's: the file only hands those classes back their layered values (`revert-layer`) over ITUN's unlayered element rules, and styles nothing of its own.",
  },
]

// ── shared CSS helpers ───────────────────────────────────────────────────────

/** Strip /* … *\/ comments so regexes never match commented-out CSS. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

/**
 * Strip both block and line comments from TS/TSX so class-name extraction never
 * mistakes PROSE for a live reference: documentation of a removed class must
 * not read as a usage.
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
      // DEFINING a reserved-namespace token anywhere in an app is forbidden —
      // EXCEPT re-pointing an existing lib token inside @media print (theme.css
      // sanctions the white-paper print override). Never exempted by file. (An
      // app `@theme` block is Tailwind syntax, which `no-tailwind` fails.)
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

// ── Rule 3: dash-class-contract ───────────────────────────────────────────────
//
// The Dashboard's `.su-dash-*` classes (ITUN's own stylesheets).

const DASHBOARD_CSS_FILES = [
  'DashboardCanvas.css',
  'DashboardGrid.css',
  'instruments.css',
  'DashboardPhone.css',
].map((f) => `${DASHBOARD_DIR}/${f}`)

function scanDashContract(c: Corpus): Finding[] {
  const out: Finding[] = []

  // DEFINED: `.su-dash-*` class selectors in the dashboard CSS files (exact).
  const defined = new Map<string, { file: string; line: number }>()
  for (const relPath of DASHBOARD_CSS_FILES) {
    const css = stripCssComments(c.read(relPath))
    css.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/\.(su-dash-[a-z0-9-]+)/g)) {
        const name = m[1]
        if (name !== undefined && !defined.has(name))
          defined.set(name, { file: relPath, line: i + 1 })
      }
    })
  }

  // USED: exact `su-dash-*` tokens appearing in any .tsx/.ts (incl. tests +
  // stories) repo-wide. Exact-token extraction (not prefix matching) is
  // load-bearing: `su-dash-display` and `su-dash-display-light` are DIFFERENT
  // classes, and a prefix match would let one usage falsely "cover" the other.
  //
  // Two precision guards keep this to genuine className references:
  //  - block comments are stripped, so a JSDoc line documenting a REMOVED class
  //    is not mistaken for a live usage.
  //  - a `su-dash-*` string sitting in a NON-class attribute
  //    (`name="su-dash-deck-currency"`
  //    is a radio-group name, not a class) is skipped — it is not part of the
  //    class contract and must not gate it.
  const used = new Map<string, { file: string; line: number }>()
  for (const relPath of c.allTs) {
    stripTsComments(c.read(relPath))
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(/\bsu-dash-[a-z0-9-]+/g)) {
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
        detail: `dashboard class '${name}' used but not defined in styles/dashboard/*.css`,
      })
    }
  }
  // (b) defined-but-unused — dead dashboard CSS.
  for (const [name, where] of defined) {
    if (!used.has(name)) {
      out.push({
        file: where.file,
        line: where.line,
        detail: `dashboard class '.${name}' defined but never referenced`,
      })
    }
  }
  return out
}

// ── rule table ────────────────────────────────────────────────────────────────

/** The ONE stylesheet entry: it alone imports the reset and the package stylesheet. */
const STYLESHEET_ENTRY = 'packages/component-lib/src/styles/entry.css'

/**
 * Every stylesheet that loads the package — the two app entries and the story catalog's.
 * Named explicitly rather than discovered, because the property being checked
 * is about these files SPECIFICALLY: a partial like `print.css` neither should
 * nor could carry the import.
 */
const ENTRY_CONSUMERS = [
  'apps/itun/src/index.css',
  'apps/srd/src/styles/global.css',
  'apps/catalog/src/catalog.css',
] as const

/**
 * The package-stylesheet wiring, in the one file that owns it, and the one
 * import every consumer makes of that file.
 *
 * WHY A GUARD. This is the highest-consequence silent failure in the styling
 * system, and it fails in three different directions:
 *
 *   MISSING IMPORT — every component styled by a `.su-*` class renders
 *   unstyled. The library still compiles and every test still passes. Nothing
 *   but a human eye on the real app would notice.
 *
 *   UNLAYERED IMPORT — worse, because it looks like the tidier spelling. The
 *   apps' stylesheets are unlayered, and unlayered CSS beats layered CSS
 *   whatever the specificity. Imported bare, `index.css` would compete with
 *   every app rule on specificity instead, and win wherever it out-specifies
 *   one: the cascade the apps are written against flips, rule by rule. (Under
 *   the old utilities layer a bare import measurably flattened the type on
 *   every heading: `h1,…,h6 { font-size: inherit }` outranked every size.)
 *   The reset likewise sits in a layer BEFORE the package's, or its element
 *   rules override the components.
 *
 *   A SECOND ENTRY — a consumer that imports `index.css` or the reset itself
 *   instead of the shared entry restates the layer order and the imports, and
 *   the copies drift. There were four once.
 *
 * All three are invisible to typecheck, lint and the test suite, which is
 * exactly the standard the sibling rules in this file are held to. The layer
 * NAMES are not asserted — only that each import carries some `layer(...)` and
 * that the declared order puts the reset's first — so renaming `su-base`
 * stays cheap while removing the layering does not.
 */
function scanPackageStylesheetImport(c: Corpus): Finding[] {
  const out: Finding[] = []

  for (const rel of ENTRY_CONSUMERS) {
    const css = stripCssComments(c.read(rel))
    if (!/@import\s+['"]component-lib\/styles\/entry\.css['"]/.test(css)) {
      out.push({
        file: rel,
        line: 1,
        detail: `does not import the shared stylesheet entry (${STYLESHEET_ENTRY})`,
      })
    }
    const own = css
      .split('\n')
      .findIndex((l) => /@import\s+['"][^'"]*\/(?:index|reset)\.css['"]/.test(l))
    if (own !== -1) {
      out.push({
        file: rel,
        line: own + 1,
        detail:
          'imports the package stylesheet or the reset itself — a second entry beside the shared one',
      })
    }
  }

  const css = stripCssComments(c.read(STYLESHEET_ENTRY))
  const lines = css.split('\n')
  const orderDecl = css.match(/@layer\s+([a-z0-9,\s-]+);/i)
  const order = orderDecl?.[1]?.split(',').map((n) => n.trim()) ?? []
  const layers: number[] = []
  for (const file of ['reset.css', 'index.css']) {
    const importLine = lines.findIndex((l) =>
      new RegExp(`@import\\s+['"]\\./${file.replace('.', '\\.')}['"]`).test(l)
    )
    if (importLine === -1) {
      out.push({
        file: STYLESHEET_ENTRY,
        line: 1,
        detail: `does not import './${file}' — ${file === 'index.css' ? 'every `.su-*` component renders unstyled' : 'every element loses its reset'}`,
      })
      return out
    }
    const layerName = (lines[importLine] ?? '').match(/layer\(([a-z0-9-]+)\)/i)?.[1]
    if (layerName === undefined) {
      out.push({
        file: STYLESHEET_ENTRY,
        line: importLine + 1,
        detail: `imports './${file}' WITHOUT a cascade layer — unlayered, it competes with the apps' own rules on specificity`,
      })
      return out
    }
    if (!order.includes(layerName)) {
      out.push({
        file: STYLESHEET_ENTRY,
        line: importLine + 1,
        detail: `imports into layer(${layerName}) but no @layer declaration names it — layer order then depends on emission order`,
      })
      return out
    }
    layers.push(order.indexOf(layerName))
  }
  if ((layers[0] ?? 0) >= (layers[1] ?? 0)) {
    out.push({
      file: STYLESHEET_ENTRY,
      line: 1,
      detail:
        "the reset's layer is not declared BEFORE the package stylesheet's — the reset then overrides the components",
    })
  }
  return out
}

// ── Rule 5: no-tailwind ───────────────────────────────────────────────────────

/**
 * Every manifest a dependency can be declared in: the root and each workspace,
 * read from the root manifest's own `workspaces` globs so a new workspace
 * (`tools` is one that sits outside `apps/` and `packages/`) cannot slip past.
 */
function manifests(root: string): string[] {
  if (!existsSync(join(root, 'package.json'))) return []
  const rootManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    workspaces?: string[] | { packages?: string[] }
  }
  const ws = rootManifest.workspaces
  const patterns = (Array.isArray(ws) ? ws : (ws?.packages ?? [])).filter(
    (pattern) => !pattern.startsWith('!')
  )
  const found = new Set<string>()
  for (const pattern of patterns) {
    const glob = new Bun.Glob(`${pattern.replace(/\/+$/, '')}/package.json`)
    for (const rel of glob.scanSync({ cwd: root, dot: false, followSymlinks: false })) {
      found.add(rel)
    }
  }
  return ['package.json', ...[...found].sort()]
}

const TAILWIND_PACKAGE = /^(?:tailwindcss|@tailwindcss\/.+|tailwind-.+|.+-tailwindcss)$/
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

/**
 * The at-rules only Tailwind gives meaning to. `@layer utilities` is the layer
 * its utilities compile into: no built page carries a class from one.
 */
const TAILWIND_AT_RULE =
  /@(?:tailwind|apply|theme|utility|variant|custom-variant|source|plugin|config|reference)\b|@layer\s+utilities\b/

/**
 * Tailwind is gone (ADR-046) and this keeps it gone. A one-off crawl of every
 * built page and story for a class from built CSS's `@layer utilities` found
 * none. A utility can only reach built CSS again
 * through a Tailwind package (it generates them) or a Tailwind directive in
 * a stylesheet (the compiler reads them), so this checks both sources, every
 * workspace's manifest and every stylesheet under `apps/` and `packages/`, and
 * needs no build to run.
 */
function scanNoTailwind(c: Corpus): Finding[] {
  const out: Finding[] = []
  for (const rel of manifests(c.root)) {
    const manifest = JSON.parse(c.read(rel)) as Record<string, unknown>
    const lines = c.read(rel).split('\n')
    for (const field of DEPENDENCY_FIELDS) {
      const deps = manifest[field]
      if (deps === null || typeof deps !== 'object') continue
      for (const name of Object.keys(deps)) {
        if (!TAILWIND_PACKAGE.test(name)) continue
        const line = lines.findIndex((l) => l.includes(`"${name}"`))
        out.push({ file: rel, line: line + 1, detail: `${field} declares '${name}'` })
      }
    }
  }
  for (const rel of listFiles(c.root, ['apps', 'packages'], ['.css'])) {
    stripCssComments(c.read(rel))
      .split('\n')
      .forEach((text, i) => {
        const m = text.match(TAILWIND_AT_RULE)
        if (m) out.push({ file: rel, line: i + 1, detail: `Tailwind directive '${m[0]}'` })
      })
  }
  return out
}

// ── Rule 6: style-object-annotation ───────────────────────────────────────────

/**
 * A style object is written ONE way (.claude/rules/styling.md, "The written
 * form"): `const NAME = { … } satisfies CSSProperties`. The annotated spelling,
 * `const NAME: CSSProperties = { … }`, widens every value to the whole
 * property type, so the object no longer says what it holds, and it is the
 * second of two spellings for one thing. It was 531 lines when this rule
 * landed; the ratchet only lets that fall. A function that builds a style
 * (`(x): CSSProperties => ({ … })`) is not this spelling and is not counted.
 */
const STYLE_OBJECT_ANNOTATION = /:\s*(?:React\.)?CSSProperties\s*=(?!>)/

function scanStyleObjectAnnotation(c: Corpus): Finding[] {
  const out: Finding[] = []
  for (const rel of c.allTs) {
    stripTsComments(c.read(rel))
      .split('\n')
      .forEach((text, i) => {
        if (STYLE_OBJECT_ANNOTATION.test(text)) {
          out.push({ file: rel, line: i + 1, detail: text.trim().replace(/\s*\{?$/, '') })
        }
      })
  }
  return out
}

type OwnershipRule = Rule & { scan: (c: Corpus) => Finding[] }

const RULES: OwnershipRule[] = [
  {
    id: 'app-theme',
    mode: 'zero',
    rule: 'source-of-truth §component-lib owns shared styling — no app-local design tokens',
    fix: 'Move the token into packages/component-lib/src/styles/theme.css so both apps share one source. A print-time re-point of an EXISTING lib token belongs inside @media print (already allowed).',
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
    id: 'dash-class-contract',
    mode: 'zero',
    rule: 'source-of-truth §the dashboard class contract is closed and bidirectional',
    fix: 'used-but-undefined: define the `su-dash-*` class in apps/itun/src/styles/dashboard/*.css (or fix the className typo in the .tsx). defined-but-unused: delete the dead rule, or reference it. Match the EXACT class name — su-dash-display and su-dash-display-light are different classes.',
    scan: scanDashContract,
  },
  {
    id: 'package-stylesheet-import',
    mode: 'zero',
    rule: 'ruleset §the package stylesheet is the ONE stylesheet a consumer loads, layered under the apps (#799, epic #802)',
    fix: "Every consumer (both apps and the story catalog) imports 'component-lib/styles/entry.css' and never index.css or reset.css itself. That one entry declares the order (`@layer su-reset, su-base;`) and imports './reset.css' layer(su-reset) and './index.css' layer(su-base), after the theme.css import.",
    scan: scanPackageStylesheetImport,
  },
  {
    id: 'no-tailwind',
    mode: 'zero',
    rule: 'ADR-046 §no utility framework: Tailwind stays removed',
    fix: "Remove the Tailwind package or directive. A value goes in theme.css (and tokens.ts), a style in a style object or a `.su-*` rule in index.css (an app's own stylesheet when only that app uses it); see .claude/rules/styling.md.",
    scan: scanNoTailwind,
  },
  {
    id: 'style-object-annotation',
    mode: 'ratchet',
    rule: '.claude/rules/styling.md §the written form: a style object is `const NAME = { … } satisfies CSSProperties`',
    fix: 'Write `const NAME = { … } satisfies CSSProperties` instead of `const NAME: CSSProperties = { … }`. A value that varies by instance spreads the object (`style={{ ...NAME, color }}`); a stateful, responsive or repeated property is a `.su-*` class. Then lower the baseline: bun tools/check-styling.ts --update-baseline.',
    scan: scanStyleObjectAnnotation,
  },
]

// ── preconditions ───────────────────────────────────────────────────────────

function preflight(root: string): void {
  const c = corpus(root)
  /**
   * Catastrophe floors for the file sets. Today: 3 app CSS files, ~510 app
   * source files, ~1,170 repo-wide TS files. Each is set
   * far below the real count — see packages/gates/lib/scanFloor.ts. `appCss` is only 3
   * files, so its floor is necessarily blunt; it still catches the directory
   * list going stale and the set collapsing to zero.
   */
  assertScanFloor('styling ownership (app CSS)', c.appCss.length, 2)
  assertScanFloor('styling ownership (app source)', c.appSource.length, 350)
  assertScanFloor('styling ownership (repo TS)', c.allTs.length, 800)
  // `no-tailwind`: today 12 manifests (the root and eleven workspaces) and 29 stylesheets.
  assertScanFloor('styling ownership (manifests)', manifests(root).length, 5)
  assertScanFloor(
    'styling ownership (all CSS)',
    listFiles(root, ['apps', 'packages'], ['.css']).length,
    10
  )

  /**
   * APP_DIRS is the set of apps whose LOCAL css this rule set audits, and it is
   * a hardcoded list. The gaps are real decisions rather than oversights, so
   * they are written down: this is about an app owning styling it should not
   * own, and a workspace with no stylesheet cannot violate that. If any of
   * these ever grows a `.css` file, the exemption becomes stale and this
   * assertion fails — which is the point. See packages/gates/lib/workspaceCoverage.ts.
   */
  assertCoversWorkspaces('styling ownership', APP_DIRS, {
    'apps/discord-bot':
      'ships no stylesheet — it renders Discord Components V2 containers, not DOM.',
    'apps/su-assets': 'a Worker that serves image bytes and short error strings; no CSS, no DOM.',
    'packages/itun-domain':
      'schemas and rules shared with Convex and the bot; no components and no stylesheet.',
    'packages/observability': 'Sentry wiring only; no components and no stylesheet.',
    'packages/salvageunion-reference': 'data and ORM; no components and no stylesheet.',
    'packages/component-lib': 'is the OWNER this gate checks apps against, not an app to audit.',
    'packages/gates': 'the gates themselves; no components and no stylesheet.',
  })
}

export const stylingOwnership: RuleSet = {
  id: 'styling',
  label: 'styling ownership',
  rules: RULES,
  exemptionsLive: 'packages/gates/rules/stylingOwnership.ts',
  preflight,
  scan(root) {
    const c = corpus(root)
    const out: Record<string, Finding[]> = {}
    for (const rule of RULES) out[rule.id] = rule.scan(c)
    return out
  },
}
