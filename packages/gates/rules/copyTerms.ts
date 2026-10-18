/**
 * Copy lint for game terms — the `copy` rule set of `tools/check-rule-sets.ts`.
 *
 * The book capitalises its game nouns: the Core Book writes "Mech" 968 times
 * and "mech" 15, "Pilot" 452 and "pilot" 16. An audit of the Cantina's copy found it
 * lower case about half the time ("mech" 91, "Mech" 77), "TL" where the book
 * says "Tech N" or "Tech Level", "Heat Cap" in prose where the book says "Heat
 * Capacity", and the product named three ways. None of that fails typecheck,
 * lint or a test, so nothing held it.
 *
 * ## The corpus: what counts as copy
 *
 * Every `.ts`/`.tsx` file a user-facing surface ships (`COPY_DIRS`), parsed
 * with oxc, contributes:
 *
 *   - every JSX text node;
 *   - every string literal and template-literal chunk that reads as prose (two
 *     words separated by whitespace), outside an import, the calls whose
 *     arguments are not copy (`isSkippedCall`: a `bookQuote(…)`, the book's
 *     own words held to the book by the rules-fidelity lock; a `console.*`
 *     line; a zod `.describe(…)`) and the JSX attributes that carry markup
 *     rather than words (`NON_COPY_ATTRS`).
 *
 * A one-word string literal is an identifier far more often than copy
 * (`schema === 'mech'`), so it is not read; a one-word JSX text node is copy.
 *
 * ## The rules
 *
 *   - `lowercase-term` — a game term written with a lower-case word. The term
 *     list is `data/keywords.json`, so the dataset is the style guide: a
 *     keyword counts when the dataset's own prose (book text, held verbatim by
 *     the fidelity lock) capitalises it in at least `CAPITALISED_SHARE` of at
 *     least `MIN_USES` uses. That keeps "Mech", "Pilot", "Tech Level" and
 *     "Hit Points", and leaves the keywords the book also uses as plain English
 *     ("move", "damaged", "group").
 *   - `banned-variant` — a spelling the book or the product does not use:
 *     `BANNED`, plus any other casing of the product's names in
 *     `game-domain/src/product.ts` (read from that file, never retyped).
 *
 * Both are ratchets against `tools/baselines/rule-sets.json`: today's copy
 * is the baseline, a new finding fails, and a fixed one must be locked in.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSync } from 'oxc-parser'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'
import { assertCoversWorkspaces } from '../lib/workspaceCoverage'

// ── the corpus ───────────────────────────────────────────────────────────────

/** The source trees whose strings reach a reader. */
const COPY_DIRS = [
  'apps/web/convex',
  'apps/web/src',
  'apps/discord-bot/src',
  'packages/game-domain/src',
  'packages/salvageunion-reference/lib',
] as const

/** Files in those trees that are not shipped copy. */
const SKIP_FILE =
  /(^|\/)(__tests__|_generated|generated)\/|\.(test|d)\.tsx?$|\/proseDeviations\.ts$/

/**
 * JSX attributes whose value is markup, not words: a class list, an SVG path,
 * a media query. Every other attribute (`aria-label`, `title`, a component's
 * `label`) is copy.
 */
const NON_COPY_ATTRS = new Set([
  'className',
  'class',
  'style',
  'd',
  'viewBox',
  'points',
  'transform',
  'sizes',
  'srcSet',
  'media',
  'accept',
  'autoComplete',
])

/** Two words separated by whitespace: the shortest string literal read as copy. */
const PROSE = /[A-Za-z]{2,}[.,:;!?’']?\s+\S*[A-Za-z]/

export type CopyString = { file: string; line: number; text: string }

type Node = { type?: unknown; start?: unknown; [k: string]: unknown }
const isNode = (v: unknown): v is Node => !!v && typeof v === 'object' && !Array.isArray(v)

function lineIndex(source: string): (offset: number) => number {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  return (offset) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if ((starts[mid] ?? 0) <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

/**
 * Calls whose string arguments are not copy: `bookQuote(…)` holds the book's
 * own words, `console.*(…)` writes to a developer, and a zod `.describe(…)`
 * documents a schema field.
 */
function isSkippedCall(callee: unknown): boolean {
  if (!isNode(callee)) return false
  if (callee.type === 'Identifier') return callee.name === 'bookQuote'
  if (callee.type !== 'MemberExpression' || !isNode(callee.property)) return false
  if (callee.property.name === 'describe') return true
  return isNode(callee.object) && callee.object.name === 'console'
}

function attrName(n: Node): string | undefined {
  return isNode(n.name) && typeof n.name.name === 'string' ? n.name.name : undefined
}

/** Every copy string in one source file. Pure: the caller reads the file. */
export function extractCopy(file: string, source: string): CopyString[] {
  const lineOf = lineIndex(source)
  const out: CopyString[] = []
  const push = (text: string, start: unknown) => {
    const trimmed = text.replace(/\s+/g, ' ').trim()
    if (trimmed) out.push({ file, line: lineOf(Number(start)), text: trimmed })
  }
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) visit(x)
      return
    }
    if (!isNode(v)) return
    switch (v.type) {
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
      case 'ImportExpression':
      case 'TSImportType':
      case 'TSExternalModuleReference':
        return
      case 'ExportNamedDeclaration':
        visit(v.declaration)
        return
      case 'CallExpression':
        if (isSkippedCall(v.callee)) return
        break
      case 'JSXAttribute': {
        const name = attrName(v)
        if (name && (NON_COPY_ATTRS.has(name) || name.startsWith('data-'))) return
        break
      }
      case 'JSXText':
        if (typeof v.value === 'string' && /[A-Za-z]/.test(v.value)) push(v.value, v.start)
        return
      case 'Literal':
        if (typeof v.value === 'string' && PROSE.test(v.value)) push(v.value, v.start)
        return
      case 'TemplateElement': {
        const cooked = (v.value as { cooked?: unknown } | undefined)?.cooked
        if (typeof cooked === 'string' && PROSE.test(cooked)) push(cooked, v.start)
        return
      }
    }
    for (const [k, x] of Object.entries(v)) if (k !== 'parent') visit(x)
  }
  visit(parseSync(file, source).program)
  return out
}

function copyFiles(root: string): string[] {
  return listFiles(root, COPY_DIRS, ['.ts', '.tsx']).filter((f) => !SKIP_FILE.test(f))
}

function collectCopy(root: string): CopyString[] {
  return copyFiles(root).flatMap((f) => extractCopy(f, readFileSync(join(root, f), 'utf8')))
}

// ── the term list: data/keywords.json, weighed by the dataset's own prose ────

export const DATA_DIR = 'packages/salvageunion-reference/data'

/** A keyword is a capitalised term when the dataset capitalises at least this share of its uses… */
export const CAPITALISED_SHARE = 0.8
/** …across at least this many uses. */
export const MIN_USES = 5

/** Fields that name or key a record rather than say something about it. */
const NON_PROSE_KEYS = new Set(['id', 'name', 'source', 'slug', 'booklet'])

/**
 * `term(s)`, any casing, words joined by any whitespace. A hyphen, a slash or
 * a dot joined to a word on either side is a slug, a class name or a host
 * (`su-mech-card`, `/schema/mech/`, `cantina.salvageunion.io`), not a word.
 */
export function termPattern(term: string): RegExp {
  const body = term
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  return new RegExp(`(?<![\\w/-]|\\w\\.)${body}s?(?![\\w/-]|\\.\\w)`, 'gi')
}

/** Every word of the match starts upper case ("Mech", "Hit Points", "Bio-Titan", "MECH"). */
const isCapitalised = (match: string) => match.split(/[\s-]+/).every((w) => /^[A-Z]/.test(w))

/** The keywords' plain names: "difficult terrain (False Flag)" is "difficult terrain". */
function keywordTerms(root: string): string[] {
  const raw = JSON.parse(readFileSync(join(root, DATA_DIR, 'keywords.json'), 'utf8')) as {
    name: string
  }[]
  const terms = raw
    .map((k) => k.name.replace(/\s*\(.*\)\s*$/, '').trim())
    .filter((t) => t && !t.includes('/'))
  return [...new Set(terms)]
}

function datasetProse(root: string): string {
  const prose: string[] = []
  const walk = (v: unknown, key: string): void => {
    if (typeof v === 'string') {
      if (!NON_PROSE_KEYS.has(key) && /\s/.test(v)) prose.push(v)
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x, key)
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, k)
    }
  }
  for (const f of listFiles(root, [DATA_DIR], ['.json'])) {
    walk(JSON.parse(readFileSync(join(root, f), 'utf8')), '')
  }
  return prose.join('\n')
}

export type TermUse = { term: string; capitalised: number; lower: number }

/** Each keyword with how the dataset's prose spells it. */
export function weighTerms(root: string): TermUse[] {
  const text = datasetProse(root)
  return keywordTerms(root).map((term) => {
    let capitalised = 0
    let lower = 0
    for (const m of text.matchAll(termPattern(term))) {
      if (isCapitalised(m[0])) capitalised++
      else lower++
    }
    return { term, capitalised, lower }
  })
}

/** The keywords the dataset capitalises: the `lowercase-term` list. */
export function capitalisedTerms(uses: readonly TermUse[]): string[] {
  return uses
    .filter((u) => {
      const n = u.capitalised + u.lower
      return n >= MIN_USES && u.capitalised / n >= CAPITALISED_SHARE
    })
    .map((u) => u.term)
}

// ── banned variants ──────────────────────────────────────────────────────────

export type Banned = {
  pattern: RegExp
  /** The spelling to use instead; a match spelled exactly so passes. */
  say: string
  why: string
  /** A string that is wholly this (a bare label) is allowed. */
  allowWhole?: RegExp
}

/** Spellings the book does not use, each with what it says instead and where. */
export const BANNED: readonly Banned[] = [
  {
    pattern: /(?<![\w-])TL ?\d?(?![\w-])/g,
    say: 'Tech Level, or Tech N',
    why: 'the book never abbreviates it: "Tech Level 1" (Core Book p.15), "TECH 1" to "TECH 6" (p.3)',
  },
  {
    pattern: /(?<![\w-])Heat Cap(?!acity)(?![\w-])/gi,
    say: 'Heat Capacity',
    why: 'the book writes "Heat Capacity" in prose (Core Book p.97, p.234), and every long label spells it out',
  },
  {
    // "scrapped" and "scrapping" are only ever the verb; "Scrap" is the verb
    // where it opens a sentence before its object ("Scrap the mech").
    pattern:
      /(?<![\w-])[Ss]crap(?:ped|ping)(?![\w-])|(?<=^|[.!?]\s)Scrap(?= (?:a|an|the|this|that|it|them)\b)/g,
    say: 'Break down (or Delete, for a record)',
    why: 'Scrap is the currency; the book\'s verb is "break down" (Core Book p.248), and the ruleset\'s verb list (§3.12) is Copy / Move / Delete / Break down',
  },
  {
    // An initialism is a name, not a shout.
    pattern: /(?<![\w-])(?!(?:TTRPG|JSON|JPEG|HTML|CORS)(?![\w-]))[A-Z]{4,}(?![\w-])/g,
    say: 'sentence case',
    why: 'caps in a sentence shout; a capitalised label is the stamp component (Badge shape="stamp"), ruleset §3.12',
    // A string with no lower case is a label set in caps on purpose (the
    // Discord bot's `-# FOUND IN` subtext, where a stamp cannot reach).
    allowWhole: /^[^a-z]*$/,
  },
]

export const PRODUCT_FILE = 'packages/game-domain/src/product.ts'

/** `name` and `shortName` of `PRODUCT`, read from its source. */
export function productNames(root: string): { name: string; shortName: string } {
  const source = readFileSync(join(root, PRODUCT_FILE), 'utf8')
  const name = source.match(/\bname: '([^']+)'/)?.[1]
  const shortName = source.match(/\bshortName: '([^']+)'/)?.[1]
  if (!name || !shortName) throw new Error(`${PRODUCT_FILE}: cannot read PRODUCT.name/shortName`)
  return { name, shortName }
}

/**
 * Any other casing of the product's two names. A bracketed `[cantina]` is a log
 * tag, not the name.
 */
export function productBans(product: { name: string; shortName: string }): Banned[] {
  return [product.name, product.shortName].map((spelling) => ({
    pattern: new RegExp(`(?<!\\[)${termPattern(spelling).source}(?!\\])`, 'gi'),
    say: spelling,
    why: `the product is spelled once, in ${PRODUCT_FILE} (import PRODUCT)`,
  }))
}

// ── the rules ───────────────────────────────────────────────────────────────

const RULES: readonly Rule[] = [
  {
    id: 'lowercase-term',
    rule: 'a game term the dataset capitalises is written with a lower-case word',
    fix: 'capitalise it as the book does (Mech, Pilot, Tech Level, Hit Points)',
    mode: 'ratchet',
  },
  {
    id: 'banned-variant',
    rule: 'a spelling the book or the product does not use',
    fix: 'use the spelling the finding names',
    mode: 'ratchet',
  },
]

const titleCase = (term: string) =>
  term.replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())

/** Findings for a corpus, given the term list and the bans. Pure. */
export function lintCopy(
  copy: readonly CopyString[],
  terms: readonly string[],
  bans: readonly Banned[]
): Record<string, Finding[]> {
  const lowercase: Finding[] = []
  const banned: Finding[] = []
  // Longest first, so "weapons system" is one finding, not also "system".
  const termRes = [...terms]
    .sort((a, b) => b.length - a.length)
    .map((t) => [t, termPattern(t)] as const)
  for (const c of copy) {
    const taken: [number, number][] = []
    for (const [term, re] of termRes) {
      for (const m of c.text.matchAll(re)) {
        const from = m.index
        const to = from + m[0].length
        if (taken.some(([a, b]) => from < b && to > a)) continue
        taken.push([from, to])
        if (isCapitalised(m[0])) continue
        lowercase.push({ file: c.file, line: c.line, detail: `"${m[0]}": say ${titleCase(term)}` })
      }
    }
    for (const ban of bans) {
      if (ban.allowWhole?.test(c.text)) continue
      for (const m of c.text.matchAll(ban.pattern)) {
        if (m[0] === ban.say) continue
        banned.push({ file: c.file, line: c.line, detail: `"${m[0]}": say ${ban.say}; ${ban.why}` })
      }
    }
  }
  return { 'lowercase-term': lowercase, 'banned-variant': banned }
}

/** Fewer files than this means a scanned directory moved (packages/gates/lib/scanFloor.ts). */
const FILE_FLOOR = 500
/** Fewer capitalised terms than this means keywords.json or the dataset moved. */
const TERM_FLOOR = 20

export const copyTerms: RuleSet = {
  id: 'copy',
  label: 'copy: game terms',
  rules: RULES,
  preflight(root) {
    assertScanFloor('copy', copyFiles(root).length, FILE_FLOOR)
    assertScanFloor(
      `copy (capitalised terms from ${DATA_DIR}/keywords.json)`,
      capitalisedTerms(weighTerms(root)).length,
      TERM_FLOOR
    )
    assertCoversWorkspaces('copy', COPY_DIRS, {
      'apps/su-assets': 'a Worker that serves image bytes and short error strings; no copy.',
      'packages/gates': 'the gates themselves; their fixtures spell the variants they catch.',
    })
  },
  scan(root) {
    const terms = capitalisedTerms(weighTerms(root))
    const bans = [...BANNED, ...productBans(productNames(root))]
    return lintCopy(collectCopy(root), terms, bans)
  },
  exemptionsLive: 'packages/gates/rules/copyTerms.ts',
  summary(root) {
    const terms = capitalisedTerms(weighTerms(root))
    return `${collectCopy(root).length} copy strings in ${copyFiles(root).length} files, ${terms.length} terms from keywords.json`
  },
}
