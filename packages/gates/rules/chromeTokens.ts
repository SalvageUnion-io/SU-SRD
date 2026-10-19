/**
 * Chrome-token laws — the second half of the `tokens` rule set of
 * `tools/check-rule-sets.ts` (docs/design-system/chrome.md, hard-rules.md).
 *
 * `designTokens.ts` matches a literal on a line. These laws need to know
 * where a declaration sits: which selector a `dashed` is under, whether a left
 * border's rule also draws the right edge, which `@media` block a loop runs
 * in. So this module parses each stylesheet into its declarations and blocks
 * (`parseCss`, `lib/styleSource.ts`) and reads a style object as the braces
 * around a match (`enclosingObject`), and every rule is a function over that,
 * not a regex.
 *
 * It shares the `tokens` id with `designTokens.ts`, so its findings print as
 * `tokens/<rule>` and `--only=tokens` runs both halves.
 *
 * ## Every rule is zero
 *
 * Any finding fails, and none has a baseline entry. A genuinely-correct case
 * is an EXEMPTIONS entry with a written reason, or a `design-tokens-ignore`
 * comment on its line.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Exemption, Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { isExempt, listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'
import type { CssBlock, CssDecl } from '../lib/styleSource'
import {
  blankScriptComments,
  enclosingObject,
  lineAt,
  matchesIn,
  parseCss,
} from '../lib/styleSource'
import { assertCoversWorkspaces } from '../lib/workspaceCoverage'

const SCAN_DIRS = [
  'packages/salvageunion-reference/lib',
  'apps/web/src',
  'apps/discord-bot/src',
  'apps/su-assets/src',
  'packages/game-domain/src',
]

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.css']

/** A parsed source: a stylesheet's declarations, or a script with comments blanked. */
type Source =
  | { kind: 'css'; rel: string; lines: string[]; decls: CssDecl[]; blocks: CssBlock[] }
  | { kind: 'script'; rel: string; lines: string[]; text: string }

type ChromeRule = Rule & {
  css?: (decls: CssDecl[], blocks: CssBlock[], rel: string) => { line: number; detail: string }[]
  script?: (text: string, rel: string) => { offset: number; detail: string }[]
}

// ── Left rail (§3.10) ─────────────────────────────────────────────────────────

const LEFT_EDGE = /^border-(?:left|inline-start)(?:-width)?$/
const RIGHT_EDGE = /^border-(?:right|inline-end)(?:-width)?$/

/** The width a border shorthand or `-width` longhand gives its edge, or null for none. */
function edgeWidth(value: string): string | null {
  const first = value.trim().split(/\s+/)[0] ?? ''
  if (/^(?:0+(?:\.0+)?[a-z%]*|none|hidden)$/i.test(first)) return null
  return first
}

/**
 * A selector that reaches its subject through a sibling combinator (`a + b`,
 * `a ~ b`): the subject has a sibling before it, so a left border there is a
 * divider between two siblings, not a rail marking one block.
 */
function isDividerSelector(header: string): boolean {
  return header
    .split(',')
    .every((sel) => /[+~]\s*[^\s+~>]+\s*$/.test(sel.trim().replace(/\s*\{$/, '')))
}

const leftRailCss = (decls: CssDecl[]) =>
  decls
    .filter((d) => LEFT_EDGE.test(d.prop))
    .filter((d) => {
      const width = edgeWidth(d.value)
      if (width === null) return false
      // A frame: the same rule draws the right edge at the same width.
      const framed = d.siblings.some((s) => RIGHT_EDGE.test(s.prop) && edgeWidth(s.value) === width)
      if (framed) return false
      return !isDividerSelector(d.context[d.context.length - 1] ?? '')
    })
    .map((d) => ({ line: d.line, detail: `${d.prop}: ${d.value}` }))

const leftRailScript = (text: string) =>
  matchesIn(text, /\b(?:borderLeft|borderInlineStart)(?:Width)?\s*:\s*([^,}\n]+)/g, (m) => {
    const value = (m[1] ?? '').trim().replace(/^['"`]|['"`]$/g, '')
    if (edgeWidth(value) === null || value === '0') return false
    // A frame: the same object draws the right edge with the same value.
    const object = enclosingObject(text, m.index ?? 0)
    const right = object.match(/\b(?:borderRight|borderInlineEnd)(?:Width)?\s*:\s*([^,}\n]+)/)
    return !(right && (right[1] ?? '').trim() === (m[1] ?? '').trim())
  })

// ── Dashed (§3.9) ─────────────────────────────────────────────────────────────

/**
 * Where a stylesheet may draw dashed (ruleset §3.9): under one of these
 * selectors, each one of the four things dashed means.
 */
const DASHED_SELECTORS: readonly [RegExp, string][] = [
  [/\[data-user-made\]/, 'user-made: an entity frame, Token body or pill a player made'],
  [/\.su-badge--dashed\b/, 'user-made: the User-made stamp'],
  [/\.su-play-unit--reference\b/, 'a Play reference unit (ADR-051 §5)'],
  [/\.su-field__write-cue\b/, 'an edit field: a writable value box'],
  [/\.su-edit-cue:hover\b/, 'an edit field: the hover edit cue'],
  [/\.su-btn--pencil\b/, 'an edit field: the pencil control on an editable line'],
  [/\.su-play-discord-row\[data-unbound\]/, 'an empty slot: a channel not yet bound'],
]

/**
 * Where a style object may draw dashed: the files that draw one of the four
 * things dashed means, by file. A file here may draw dashed anywhere in it,
 * so it names one job.
 */
const DASHED_FILES: readonly [string, string][] = [
  // User-made (ruleset §3.9): what a player made, and the doors that make it.
  ['apps/web/src/components/atoms/ChapterBand.tsx', 'user-made: the dashed notch'],
  ['apps/web/src/components/referenceEntity/card/cardChrome.ts', 'user-made: the card frame'],
  [
    'apps/web/src/components/referenceEntity/card/EntityCardIdentityFooter.tsx',
    'user-made: the foot rule',
  ],
  ['apps/web/src/components/referenceEntity/card/UserMadeStamp.tsx', 'user-made: the stamp'],
  ['apps/web/src/components/compositions/OgCard.tsx', 'user-made: the share card'],
  ['apps/web/src/build/mech/Pattern/PublicPattern.tsx', 'user-made: a pattern’s page'],
  ['apps/web/src/build/mech/Pattern/SavePatternPage.tsx', 'user-made: saving a pattern'],
  ['apps/web/src/build/npc/AnyNpcDesigner.tsx', 'user-made: the NPC designer'],
  ['apps/web/src/build/npc/npcStyles.model.ts', 'user-made: the NPC builder'],
  ['apps/web/src/build/mech/MechChassisStep.tsx', 'user-made: the Custom-build door'],
  ['apps/web/src/components/atoms/ModeDoor.tsx', 'user-made: the blank-build door'],
  // An edit field: Edit's controls are pencil (ruleset §1.2).
  ['apps/web/src/components/atoms/Field.tsx', 'an edit field'],
  ['apps/web/src/components/atoms/Conditions.tsx', 'an edit field: the + Add chip'],
  ['apps/web/src/components/containers/AdderBox.tsx', 'an edit field: the + add intake'],
  ['apps/web/src/components/referenceEntity/card/StatusRail.tsx', 'an edit field: the live rail'],
  // An empty slot.
  ['apps/web/src/components/atoms/SlotGrid.tsx', 'an empty slot: a cargo cell'],
  ['apps/web/src/components/shared/EmptyUnitSlot.tsx', 'an empty slot: an unfilled unit'],
  ['apps/web/src/components/containers/EmptyState.tsx', 'an empty slot: the empty state'],
  ['apps/web/src/components/shared/EntityPhoto.tsx', 'an empty slot: no photo yet'],
  ['apps/web/src/build/sheet/StorageManifest.tsx', 'an empty slot: an unlinked counterpart'],
]

const DASHED_PROP = /^(?:border|outline|column-rule|text-decoration)/

const dashedCss = (decls: CssDecl[]) =>
  decls
    .filter((d) => DASHED_PROP.test(d.prop) && /\bdashed\b/.test(d.value))
    .filter((d) => {
      const selector = d.context[d.context.length - 1] ?? ''
      // Focus is the ring's (chrome.md K9): never a dashed focus variant.
      if (/:focus/.test(selector)) return true
      return !d.context.some((header) => DASHED_SELECTORS.some(([re]) => re.test(header)))
    })
    .map((d) => ({ line: d.line, detail: `${d.context.at(-1)} { ${d.prop}: ${d.value} }` }))

const dashedScript = (text: string, rel: string) =>
  DASHED_FILES.some(([file]) => rel === file)
    ? []
    : matchesIn(
        text,
        /\b(?:border|outline|textDecoration|columnRule)\w*\s*:[^,}\n]*\bdashed\b|\bsurface\s*[=:]\s*\{?\s*['"]dashed['"]/g
      )

// ── Motion (K3) ───────────────────────────────────────────────────────────────

/** A literal, non-zero duration: `120ms`, `.3s`, `1.4s` (not `0s`, not `--dur-fast`). */
const RAW_DURATION = /(?<![\w.-])(?!0+(?:\.0+)?m?s\b)\d*\.?\d+m?s\b/
/** An easing named at the call site, not `var(--ease)`. */
const RAW_EASING =
  /(?<![\w-])(?:ease(?:-in(?:-out)?|-out)?|linear|step-start|step-end)(?![\w-])|\b(?:cubic-bezier|steps|linear)\(/
const DURATION_PROP = /^(?:transition|animation)(?:-duration|-delay)?$/
const SHORTHAND_PROP = /^(?:transition|animation)$/
const EASING_PROP = /^(?:transition|animation)(?:-timing-function)?$/

const rawDurationCss = (decls: CssDecl[]) =>
  decls
    .filter((d) => DURATION_PROP.test(d.prop) && RAW_DURATION.test(d.value))
    .map((d) => ({ line: d.line, detail: `${d.prop}: ${d.value}` }))

const rawDurationScript = (text: string) =>
  matchesIn(text, /\b(?:transition|animation)(?:Duration|Delay)?\s*:\s*[^\n]*/g, (m) =>
    RAW_DURATION.test(m[0])
  )

/**
 * An easing written at the call site, or none written at all: a shorthand
 * that does not name `var(--ease)`, or a duration longhand whose block sets
 * no timing function, runs on the browser's default `ease`.
 */
const rawEasingCss = (decls: CssDecl[]) =>
  decls
    .filter((d) => {
      if (EASING_PROP.test(d.prop) && RAW_EASING.test(d.value)) return true
      if (SHORTHAND_PROP.test(d.prop))
        return !/^none$/.test(d.value) && !d.value.includes('var(--ease)')
      if (/^(?:transition|animation)-duration$/.test(d.prop) && !/^0+m?s$/.test(d.value)) {
        const kind = d.prop.split('-')[0]
        return !d.siblings.some((s) => s.prop === `${kind}-timing-function`)
      }
      return false
    })
    .map((d) => ({ line: d.line, detail: `${d.prop}: ${d.value}` }))

const rawEasingScript = (text: string) => [
  ...matchesIn(text, /\b(?:transition|animation)(?:TimingFunction)?\s*:\s*[^\n]*/g, (m) => {
    // Only what the strings say: the `ease` token is an identifier, and an
    // interpolation (`${ease}`) is the token too.
    const strings = (m[0].match(/(['"`])(?:(?!\1).)*\1/g) ?? []).map((s) =>
      s.replace(/\$\{[^}]*\}/g, ' ')
    )
    if (strings.some((s) => RAW_EASING.test(s))) return true
    // A shorthand string must name the easing token.
    return (
      /^(?:transition|animation)\s*:/.test(m[0]) &&
      strings.length > 0 &&
      !strings.every((s) => /^.none.$/.test(s)) &&
      !/\$\{(?:\w+\.)?ease\}|var\(--ease\)/.test(m[0])
    )
  }),
  ...matchesIn(text, /\b(?:transition|animation)Duration\s*:/g, (m) => {
    const object = enclosingObject(text, m.index ?? 0)
    return !/TimingFunction\s*:/.test(object)
  }),
]

/** A loop: an animation that repeats for ever. */
const LOOP = /\binfinite\b/
const NO_PREFERENCE = /prefers-reduced-motion\s*:\s*no-preference/

const motionLoopCss = (decls: CssDecl[]) =>
  decls
    .filter((d) => /^animation(?:-iteration-count)?$/.test(d.prop) && LOOP.test(d.value))
    .filter((d) => !d.context.some((header) => NO_PREFERENCE.test(header)))
    .map((d) => ({ line: d.line, detail: `${d.prop}: ${d.value}` }))

/** A style object cannot sit under a media query, so a loop there always fails. */
const motionLoopScript = (text: string) =>
  matchesIn(text, /\banimation(?:IterationCount)?\s*:[^\n]*\binfinite\b/g)

/**
 * The loading atoms (chrome.md K6): the one pulse, `@keyframes su-pulse` and
 * `.su-pulse`, is defined in the stylesheet and worn by `SkeletonFrame`, which
 * every skeleton (`Skeleton`, `RosterSkeleton`, `SheetSkeleton`, a QR tile's)
 * is drawn in.
 */
export const LOADING_ATOMS: readonly string[] = [
  'apps/web/src/styles/partials/containers.css',
  'apps/web/src/components/containers/Skeleton.tsx',
]

const KEYFRAMES = /@keyframes\b/
const PULSE = /(?<![\w-])su-pulse(?![\w-])/

const loadingMarkCss = (_decls: CssDecl[], blocks: CssBlock[], rel: string) =>
  LOADING_ATOMS.includes(rel)
    ? []
    : blocks
        .filter((b) => KEYFRAMES.test(b.header) || PULSE.test(b.header))
        .map((b) => ({ line: b.line, detail: b.header }))

const loadingMarkScript = (text: string, rel: string) =>
  LOADING_ATOMS.includes(rel)
    ? []
    : matchesIn(text, new RegExp(`${KEYFRAMES.source}|${PULSE.source}`, 'g'))

// ── Breakpoints (K2) ──────────────────────────────────────────────────────────

/** The ladder, `breakpoint` in apps/web/src/design/tokens.ts (a test holds them equal). */
export const BREAKPOINT_LADDER = ['40rem', '48rem', '64rem', '80rem'] as const

/**
 * What is wrong with the width features of one query (a `@media` or
 * `@container` prelude, or a query string in a script): every width is
 * written `(width >= <rung>)`, a rung of the ladder; its complement is
 * `not (width >= <rung>)`. In a script the rung is read from `breakpoint`,
 * so any literal length there is a finding.
 */
function breakpointProblems(query: string, inScript = false): string[] {
  const out: string[] = []
  const feature = '(?:width|inline-size)'
  for (const m of query.matchAll(new RegExp(`\\((?:min|max)-${feature}\\s*:[^)]*\\)`, 'g')))
    out.push(`${m[0]}: write (width >= …)`)
  for (const m of query.matchAll(new RegExp(`\\(\\s*${feature}\\s*(?:<=?|>(?!=))[^)]*\\)`, 'g')))
    out.push(`${m[0]}: only (width >= …), its complement not (width >= …)`)
  for (const m of query.matchAll(
    new RegExp(`\\([^()]*[\\d.]+[a-z]*\\s*[<>]=?\\s*${feature}[^)]*\\)`, 'g')
  ))
    out.push(`${m[0]}: write (width >= …)`)
  for (const m of query.matchAll(new RegExp(`\\(\\s*${feature}\\s*>=\\s*([^)]*)\\)`, 'g'))) {
    const value = (m[1] ?? '').trim()
    if (inScript) {
      if (/\d/.test(value.replace(/\$\{[^}]*\}/g, '')))
        out.push(`${m[0]}: read the rung from \`breakpoint\``)
    } else if (!(BREAKPOINT_LADDER as readonly string[]).includes(value))
      out.push(`${m[0]}: off the ladder (${BREAKPOINT_LADDER.join(', ')})`)
  }
  return out
}

const rawBreakpointCss = (_decls: CssDecl[], blocks: CssBlock[]) =>
  blocks
    .filter((b) => /^@(?:media|container)\b/.test(b.header))
    .flatMap((b) => breakpointProblems(b.header).map((detail) => ({ line: b.line, detail })))

/** A string that holds a width query: a `matchMedia` argument, an image's `sizes`. */
const rawBreakpointScript = (text: string) =>
  [...text.matchAll(/(['"`])(?:(?!\1)[^\n])*\1/g)].flatMap((m) =>
    breakpointProblems(m[0], true).map((detail) => ({ offset: m.index ?? 0, detail }))
  )

// ── The rules ─────────────────────────────────────────────────────────────────

const CHROME_RULES: ChromeRule[] = [
  {
    id: 'left-rail',
    mode: 'zero',
    rule: 'ruleset §3.10 — no left-rail borders: colour rides in bands, stamps and gauges; nesting shows by containment',
    fix: 'Drop the rail. A tone goes in the top band or a stamp; nesting is the parent containing the child. A divider between two siblings is written `a + b { border-left }` (or on the first sibling’s right edge); a frame draws all its edges.',
    css: leftRailCss,
    script: leftRailScript,
  },
  {
    id: 'dashed',
    mode: 'zero',
    rule: 'ruleset §3.9 — dashed means user-made, a Play reference unit, an edit field or an empty slot; a Slab is solid',
    fix: 'Draw it solid. Dashed is only a thing a player made (`[data-user-made]`, the User-made stamp), a Play reference unit, an edit field or an empty slot: if this is one, add its selector to DASHED_SELECTORS (a stylesheet) or its file to DASHED_FILES (a style object) in packages/gates/rules/chromeTokens.ts, with which of the four it is. Focus is the ring, never dashed (chrome.md K9).',
    css: dashedCss,
    script: dashedScript,
  },
  {
    id: 'raw-duration',
    mode: 'zero',
    rule: 'chrome.md K3 — motion is tokens: `--dur-fast` for a state change, `--dur-base` for a move',
    fix: 'Use `var(--dur-fast)` (colour, opacity, a shadow) or `var(--dur-base)` (transform, a slide); a loading loop runs `var(--dur-loop)`. In a style object, `duration.fast` / `duration.base` from design/tokens.ts.',
    css: rawDurationCss,
    script: rawDurationScript,
  },
  {
    id: 'raw-easing',
    mode: 'zero',
    rule: 'chrome.md K3 — one easing, `--ease`',
    fix: 'Name `var(--ease)` in every transition and animation (a shorthand, or `*-timing-function` beside a duration longhand): never a keyword, a `cubic-bezier()`, or the browser default. In a style object, `ease` from design/tokens.ts.',
    css: rawEasingCss,
    script: rawEasingScript,
  },
  {
    id: 'motion-loop',
    mode: 'zero',
    rule: 'chrome.md K3 — a loop is only a loading mark, and only under `prefers-reduced-motion: no-preference`',
    fix: 'Put the looping `animation` in a stylesheet rule inside `@media (prefers-reduced-motion: no-preference) { … }`, never a style object; anything else runs once.',
    css: motionLoopCss,
    script: motionLoopScript,
  },
  {
    id: 'loading-mark',
    mode: 'zero',
    rule: 'chrome.md K6 — one loading voice: `@keyframes` and the `su-pulse` loop only in the loading atoms',
    fix: 'Wait with `Pending` (inside a screen), `Skeleton` (a shape known ahead; compose ghosts inside `SkeletonFrame`) or `RoutePending` (a route), never a loop, logo or bar of its own. The pulse is defined only in LOADING_ATOMS (packages/gates/rules/chromeTokens.ts).',
    css: loadingMarkCss,
    script: loadingMarkScript,
  },
  {
    id: 'raw-breakpoint',
    mode: 'zero',
    rule: 'chrome.md K2 — one breakpoint ladder: 40, 48, 64, 80rem, written (width >= …), media, container and script alike',
    fix: "Write `(width >= 40rem|48rem|64rem|80rem)`, phone-first; what applies below a rung is the base rule, or `not (width >= …)`. No max-width, no px, no rung between. A script builds its query from `breakpoint` (design/tokens.ts): `widthAtLeast('lg')`.",
    css: rawBreakpointCss,
    script: rawBreakpointScript,
  },
]

/**
 * Sanctioned cases. Each entry needs a reason — an exemption without a
 * justification is just a silent hole in the guardrail.
 */
const EXEMPTIONS: Exemption[] = [
  {
    file: 'apps/web/src/play/playCanvas.model.ts',
    rules: ['raw-breakpoint'],
    reason:
      "Play's phone floor (ADR-045 decision 1), the one named exception to the ladder (chrome.md K2): the canvas gives way to the phone form by its scale on both axes, not by a rung.",
  },
  {
    file: 'apps/web/src/styles/theme.css',
    rules: ['raw-duration', 'raw-easing'],
    reason:
      'The token definitions, and the reduced-motion backstop: `0.01ms !important` on every element is the guarantee that a reduce user sees no motion, not a duration anything animates at.',
  },
]

/**
 * Catastrophe floor for SCAN_DIRS, counted after tests and generated files
 * are dropped: ~900 files today (see packages/gates/lib/scanFloor.ts).
 */
const SCAN_FLOOR = 500

function scannedFiles(root: string): string[] {
  return listFiles(root, SCAN_DIRS, SCAN_EXTENSIONS).filter(
    (rel) =>
      !rel.includes('.gen.') &&
      !rel.includes('routeTree') &&
      !rel.includes('__tests__') &&
      !/\.test\.[tj]sx?$/.test(rel)
  )
}

function parse(rel: string, text: string): Source {
  const lines = text.split('\n')
  if (rel.endsWith('.css')) return { kind: 'css', rel, lines, ...parseCss(text) }
  return { kind: 'script', rel, lines, text: blankScriptComments(text) }
}

/** Findings per rule for the given sources, keyed by repo-relative path. */
export function scanChromeSources(sources: ReadonlyMap<string, string>): Record<string, Finding[]> {
  const out: Record<string, Finding[]> = {}
  for (const rule of CHROME_RULES) out[rule.id] = []
  for (const [rel, text] of sources) {
    const src = parse(rel, text)
    for (const rule of CHROME_RULES) {
      if (isExempt(EXEMPTIONS, rel, rule.id)) continue
      const hits =
        src.kind === 'css'
          ? (rule.css?.(src.decls, src.blocks, rel) ?? [])
          : (rule.script?.(src.text, rel) ?? []).map((h) => ({
              line: lineAt(src.text, h.offset),
              detail: h.detail,
            }))
      for (const hit of hits) {
        // A line may opt out with a cited reason; a block's header also by
        // the comment that opens its body (where the formatter puts it).
        const next = src.lines[hit.line]?.trim() ?? ''
        if (
          src.lines[hit.line - 1]?.includes('design-tokens-ignore') ||
          (src.kind === 'css' && next.startsWith('/*') && next.includes('design-tokens-ignore'))
        )
          continue
        out[rule.id]?.push({ file: rel, line: hit.line, detail: hit.detail })
      }
    }
  }
  return out
}

export const chromeTokens: RuleSet = {
  id: 'chrome-tokens',
  label: 'chrome tokens',
  rules: CHROME_RULES,
  exemptionsLive: 'packages/gates/rules/chromeTokens.ts (or a `design-tokens-ignore` line comment)',
  preflight(root) {
    assertScanFloor('chrome tokens', scannedFiles(root).length, SCAN_FLOOR)
    assertCoversWorkspaces('chrome tokens', SCAN_DIRS, {
      'packages/gates':
        'the gates themselves: the rule sets quote the patterns they forbid, and nothing here renders.',
    })
  },
  scan(root) {
    const sources = new Map<string, string>()
    for (const rel of scannedFiles(root)) sources.set(rel, readFileSync(join(root, rel), 'utf8'))
    return scanChromeSources(sources)
  },
  summary: (root) => `${scannedFiles(root).length} files scanned`,
}
