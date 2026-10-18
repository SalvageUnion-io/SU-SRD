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
      value: t.slice(colon + 1).trim(),
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
  css?: (decls: CssDecl[], blocks: CssBlock[]) => { line: number; detail: string }[]
  script?: (text: string) => { offset: number; detail: string }[]
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
]

/**
 * Sanctioned cases. Each entry needs a reason — an exemption without a
 * justification is just a silent hole in the guardrail.
 */
const EXEMPTIONS: Exemption[] = []

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
          ? (rule.css?.(src.decls, src.blocks) ?? [])
          : (rule.script?.(src.text) ?? []).map((h) => ({
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
