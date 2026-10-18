/**
 * Chrome-token laws — the second half of the `tokens` rule set of
 * `tools/check-rule-sets.ts` (docs/design-system/chrome.md, hard-rules.md).
 *
 * `designTokens.ts` matches a literal on a line. These laws need to know
 * where a declaration sits: which selector a `dashed` is under, whether a left
 * border's rule also draws the right edge, which `@media` block a loop runs
 * in. So this module parses each stylesheet into its declarations and blocks
 * (`parseCss`) and reads a style object as the braces around a match
 * (`enclosingObject`), and every rule is a function over that, not a regex.
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
import { assertCoversWorkspaces } from '../lib/workspaceCoverage'

const SCAN_DIRS = [
  'packages/salvageunion-reference/lib',
  'apps/web/src',
  'apps/discord-bot/src',
  'apps/su-assets/src',
  'packages/game-domain/src',
]

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.css']

// ── Parsing ───────────────────────────────────────────────────────────────────

/** One declaration of a stylesheet, with the blocks it sits in. */
export type CssDecl = {
  line: number
  /** Lower-cased property name. */
  prop: string
  value: string
  /** The headers of every enclosing block, outermost first (selectors and at-rule preludes). */
  context: readonly string[]
  /** Every declaration of the same block, this one included. */
  siblings: readonly CssDecl[]
}

/** One block header: a selector list or an at-rule prelude. */
export type CssBlock = { line: number; header: string; context: readonly string[] }

/** Comments blanked to spaces, newlines kept, so offsets and lines still agree. */
function blankComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
}

/**
 * A stylesheet's declarations and block headers. Not a CSS parser: enough of
 * one for the files this repo writes (nesting, at-rules, quoted strings).
 */
export function parseCss(text: string): { decls: CssDecl[]; blocks: CssBlock[] } {
  const src = blankComments(text)
  const decls: CssDecl[] = []
  const blocks: CssBlock[] = []
  const stack: { header: string; decls: CssDecl[] }[] = [{ header: '', decls: [] }]
  let buf = ''
  let bufLine = 0
  let line = 1
  const context = () => stack.slice(1).map((b) => b.header)
  const flush = () => {
    const t = buf.trim()
    buf = ''
    if (!t || t.startsWith('@')) return
    const colon = t.indexOf(':')
    if (colon < 0) return
    const top = stack[stack.length - 1]
    if (!top) return
    const decl: CssDecl = {
      line: bufLine,
      prop: t.slice(0, colon).trim().toLowerCase(),
      value: t
        .slice(colon + 1)
        .trim()
        .replace(/\s+/g, ' '),
      context: context(),
      siblings: top.decls,
    }
    top.decls.push(decl)
    decls.push(decl)
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string
    if (ch === '\n') line++
    if (!buf.trim() && !/\s/.test(ch)) bufLine = line
    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\') j++
        else if (src[j] === '\n') line++
        j++
      }
      buf += src.slice(i, j + 1)
      i = j
      continue
    }
    if (ch === '{') {
      const header = buf.trim().replace(/\s+/g, ' ')
      blocks.push({ line: bufLine, header, context: context() })
      stack.push({ header, decls: [] })
      buf = ''
      continue
    }
    if (ch === ';') {
      flush()
      continue
    }
    if (ch === '}') {
      flush()
      if (stack.length > 1) stack.pop()
      continue
    }
    buf += ch
  }
  return { decls, blocks }
}

/**
 * A script with its comments blanked (`//` to the end of the line, and block
 * comments), offsets and lines kept. A `//` inside a string (a URL) is left.
 */
function blankScriptComments(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i] as string
    const next = text[i + 1]
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < text.length && text[j] !== ch && !(ch !== '`' && text[j] === '\n')) {
        if (text[j] === '\\') j++
        j++
      }
      out += text.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (ch === '/' && next === '/') {
      const end = text.indexOf('\n', i)
      const stop = end < 0 ? text.length : end
      out += ' '.repeat(stop - i)
      i = stop
      continue
    }
    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end < 0 ? text.length : end + 2
      out += text.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
      continue
    }
    out += ch
    i++
  }
  return out
}

/** The 1-based line of an offset. */
function lineAt(text: string, offset: number): number {
  let n = 1
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') n++
  return n
}

/**
 * The text of the object literal (or block) around `offset`: from its `{` to
 * its `}`. Braces inside strings are rare enough in style objects to ignore.
 */
export function enclosingObject(text: string, offset: number): string {
  let start = 0
  for (let i = offset, depth = 0; i >= 0; i--) {
    if (text[i] === '}') depth++
    else if (text[i] === '{') {
      if (depth === 0) {
        start = i
        break
      }
      depth--
    }
  }
  let end = text.length
  for (let i = offset, depth = 0; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      if (depth === 0) {
        end = i + 1
        break
      }
      depth--
    }
  }
  return text.slice(start, end)
}

/** A parsed source: a stylesheet's declarations, or a script with comments blanked. */
type Source =
  | { kind: 'css'; rel: string; lines: string[]; decls: CssDecl[]; blocks: CssBlock[] }
  | { kind: 'script'; rel: string; lines: string[]; text: string }

type ChromeRule = Rule & {
  css?: (decls: CssDecl[], blocks: CssBlock[], rel: string) => { line: number; detail: string }[]
  script?: (text: string, rel: string) => { offset: number; detail: string }[]
}

/** Every match of a global pattern in a script, as offsets. */
function matchesIn(
  text: string,
  pattern: RegExp,
  keep: (m: RegExpExecArray) => boolean = () => true
): { offset: number; detail: string }[] {
  const out: { offset: number; detail: string }[] = []
  for (const m of text.matchAll(pattern)) {
    if (keep(m)) out.push({ offset: m.index ?? 0, detail: m[0].trim() })
  }
  return out
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
]

/**
 * Sanctioned cases. Each entry needs a reason — an exemption without a
 * justification is just a silent hole in the guardrail.
 */
const EXEMPTIONS: Exemption[] = [
  {
    file: 'apps/web/src/styles/theme.css',
    rules: ['raw-duration', 'raw-easing'],
    reason:
      'The token definitions, and the reduced-motion backstop: `0.01ms !important` on every element is the guarantee that a reduce user sees no motion, not a duration anything animates at.',
  },
  {
    file: 'apps/web/src/components/atoms/Slab.tsx',
    rules: ['dashed'],
    reason:
      'R1 (#1682): `Slab variant="dashed"` is the dashed section head R1 removes ("a Slab is always solid"), with every call site, as its own change. The exemption goes with the variant.',
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
        // A line may opt out with a cited reason.
        if (src.lines[hit.line - 1]?.includes('design-tokens-ignore')) continue
        out[rule.id]?.push({ file: rel, line: hit.line, detail: hit.detail })
      }
    }
  }
  return out
}

export const chromeTokens: RuleSet = {
  id: 'tokens',
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
