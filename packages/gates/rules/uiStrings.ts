/**
 * The interface's words live in the message catalogue — the `ui-strings` rule
 * set of `tools/check-rule-sets.ts` (ADR-053).
 *
 * Every label, heading, hint and line of chrome the app draws is a key in a
 * module of `apps/web/src/messages/` (`messages({ … })`), said by key at the
 * call site (`sheetCopy('removeUnit')`). English is the only language; the
 * catalogue is where another one would join, and that only works if the words
 * are all there. Nothing else notices a string typed straight into JSX, so
 * this does.
 *
 * ## What counts as a hard-coded UI string
 *
 * In a shipped `.ts`/`.tsx` file of `apps/web/src` outside the catalogue:
 *
 *   - a JSX text node with a letter in it;
 *   - a string (or template chunk) given to an attribute that carries words
 *     (`COPY_ATTRS`: `label`, `title`, `aria-label`, `placeholder`, any
 *     `…Label`, `…Title`, …) or drawn as a JSX child (`{open ? 'Hide' :
 *     'Show'}`), when it reads as words: a space, or a capital first letter
 *     (`variant="flush"` is a value, `label="Pilot"` is a word);
 *   - any other string that reads as prose (two words), outside an import, a
 *     type, an object key, a thrown or constructed `Error`, and the calls the
 *     copy set skips (`bookQuote`, `console.*`, `.describe`).
 *
 * Rules text and game data are not UI strings: they arrive from
 * `salvageunion-reference`, never as literals here.
 *
 * ## The rules
 *
 *   - `hard-coded` (ratchet) — today's uncatalogued strings are the baseline;
 *     a new one fails, and one moved into the catalogue must be locked in.
 *   - `catalogue` (zero) — `messages(…)` is called only inside the catalogue;
 *     each module's export name is unique; a key is a literal at the call
 *     (`t(open ? 'hide' : 'show')` is fine), so every key a call says is
 *     findable; and no key sits unsaid.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Node } from '../lib/jsxTree'
import { isNode, parseTsx, walk } from '../lib/jsxTree'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

const UI_DIR = 'apps/web/src'
export const CATALOGUE_DIR = 'apps/web/src/messages'
/** The catalogue's one constructor, `messages`. */
const DEFINE_MODULE = /(?:^|\/)messages\/define$/
/** A module of the catalogue, imported from anywhere. */
const CATALOGUE_MODULE = /(?:^|\/)messages\/(?!define$)[\w/-]+$/

const SKIP_FILE = /(^|\/)(__tests__|_generated|generated)\/|\.(test|d)\.tsx?$/

/** The words an attribute carrying copy is named for, alone or as a suffix (`aria-label`, `confirmLabel`). */
const COPY_WORDS = [
  'label',
  'title',
  'placeholder',
  'alt',
  'body',
  'message',
  'headline',
  'heading',
  'description',
  'hint',
  'caption',
  'text',
  'empty',
  'tooltip',
  'summary',
  'eyebrow',
  'subtitle',
  'lede',
  'note',
  'valuetext',
] as const

/** `label`, `aria-label`, `confirmLabel`, `emptyMessage`; never `context` or `bodyClassName`. */
export function isCopyAttr(name: string): boolean {
  return COPY_WORDS.some((w) => {
    if (name === w || name.endsWith(`-${w}`)) return true
    const cap = w[0]?.toUpperCase() + w.slice(1)
    return name.endsWith(cap) && name.length > w.length
  })
}

/** Attributes whose value is markup, never words. */
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
  'href',
  'src',
  'id',
  'key',
])

/** Two words separated by whitespace: a string read as prose wherever it sits. */
const PROSE = /[A-Za-z]{2,}[.,:;!?’']?\s+\S*[A-Za-z]/

/** A word a reader sees: a space, or a capital first letter (`Pilot`, not `flush`). */
const isWords = (s: string) => /[A-Za-z]/.test(s) && (/\s/.test(s.trim()) || /^\s*[A-Z]/.test(s))

const name = (n: unknown): string | undefined =>
  isNode(n) && typeof n.name === 'string' ? n.name : undefined

function isSkippedCall(callee: unknown): boolean {
  if (!isNode(callee)) return false
  if (callee.type === 'Identifier') return callee.name === 'bookQuote'
  if (callee.type !== 'MemberExpression') return false
  if (name(callee.property) === 'describe') return true
  return name(callee.object) === 'console'
}

/** The local names a file binds to modules of the catalogue, to their exported names. */
function translatorImports(program: Node): Map<string, string> {
  const out = new Map<string, string>()
  for (const stmt of program.body as Node[]) {
    if (stmt.type !== 'ImportDeclaration') continue
    const from = (stmt.source as Node).value
    if (typeof from !== 'string' || !CATALOGUE_MODULE.test(from)) continue
    for (const spec of stmt.specifiers as Node[]) {
      const local = name(spec.local)
      const imported = name(spec.imported) ?? local
      if (local && imported) out.set(local, imported)
    }
  }
  return out
}

/** The literal keys an argument can be: a string, or a conditional between strings. */
function literalKeys(arg: unknown): string[] | undefined {
  if (!isNode(arg)) return undefined
  if (arg.type === 'Literal' && typeof arg.value === 'string') return [arg.value]
  if (arg.type === 'ConditionalExpression') {
    const a = literalKeys(arg.consequent)
    const b = literalKeys(arg.alternate)
    return a && b ? [...a, ...b] : undefined
  }
  return undefined
}

/** How a string sits: what the nearest meaningful ancestors say about it. */
type Place = 'skip' | 'copy-attr' | 'drawn' | 'prose'

function placeOf(node: Node, ancestors: readonly Node[], translators: Map<string, string>): Place {
  let child: Node = node
  let drawn = true
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i] as Node
    const t = a.type
    if (
      t === 'ImportDeclaration' ||
      t === 'ExportAllDeclaration' ||
      (t === 'ExportNamedDeclaration' && a.source != null) ||
      t === 'ImportExpression' ||
      t === 'ThrowStatement' ||
      (t.startsWith('TS') &&
        t !== 'TSAsExpression' &&
        t !== 'TSSatisfiesExpression' &&
        t !== 'TSNonNullExpression')
    ) {
      return 'skip'
    }
    if (t === 'Property' && a.key === child && !a.computed) return 'skip'
    if (t === 'MemberExpression' && a.property === child) return 'skip'
    if (t === 'CallExpression') {
      if (isSkippedCall(a.callee)) return 'skip'
      const callee = name(a.callee)
      if (callee && translators.has(callee)) return 'skip'
    }
    if (t === 'NewExpression' && /Error$/.test(name(a.callee) ?? '')) return 'skip'
    if (t === 'JSXAttribute') {
      const attr = name(a.name)
      if (!attr || NON_COPY_ATTRS.has(attr) || attr.startsWith('data-')) return 'skip'
      return isCopyAttr(attr) ? 'copy-attr' : 'prose'
    }
    if (t === 'JSXExpressionContainer') {
      const parent = ancestors[i - 1]
      if (drawn && parent && (parent.type === 'JSXElement' || parent.type === 'JSXFragment')) {
        return 'drawn'
      }
    }
    const keepsPlace =
      (t === 'ConditionalExpression' && (a.consequent === child || a.alternate === child)) ||
      (t === 'LogicalExpression' && a.right === child) ||
      t === 'TemplateLiteral' ||
      t === 'JSXExpressionContainer'
    if (!keepsPlace) drawn = false
    child = a
  }
  return 'prose'
}

/** Every hard-coded UI string in one file, and its calls that say a computed key. Pure: the caller reads the file. */
export function uiStringFindings(
  file: string,
  source: string
): { hardCoded: Finding[]; computedKeys: Finding[]; importsDefine: boolean } {
  const tree = parseTsx(file, source)
  const translators = translatorImports(tree.program)
  const importsDefine = (tree.program.body as Node[]).some((s) => {
    const from = s.type === 'ImportDeclaration' ? (s.source as Node).value : undefined
    return typeof from === 'string' && DEFINE_MODULE.test(from)
  })
  const hardCoded: Finding[] = []
  const computedKeys: Finding[] = []
  const push = (n: Node, text: string) => {
    const shown = text.replace(/\s+/g, ' ').trim()
    hardCoded.push({
      file,
      line: tree.lineOf(n.start),
      detail: `"${shown.length > 60 ? `${shown.slice(0, 57)}…` : shown}"`,
    })
  }
  walk(tree.program, (n, ancestors) => {
    if (n.type === 'CallExpression') {
      const callee = name(n.callee)
      const args = n.arguments as unknown[]
      if (callee && translators.has(callee) && !literalKeys(args[0])) {
        computedKeys.push({
          file,
          line: tree.lineOf(n.start),
          detail: `${callee}(…): say the key as a literal, so the catalogue can see it is used`,
        })
      }
      return undefined
    }
    if (n.type === 'JSXText') {
      if (typeof n.value === 'string' && /[A-Za-z]/.test(n.value)) push(n, n.value)
      return false
    }
    let text: string | undefined
    if (n.type === 'Literal' && typeof n.value === 'string') text = n.value
    if (n.type === 'TemplateElement') {
      const cooked = (n.value as { cooked?: unknown } | undefined)?.cooked
      if (typeof cooked === 'string') text = cooked
    }
    if (text === undefined) return undefined
    const place = placeOf(n, ancestors, translators)
    if (place === 'skip') return false
    const words = place === 'prose' ? PROSE.test(text) : isWords(text)
    if (words) push(n, text)
    return false
  })
  return { hardCoded, computedKeys, importsDefine }
}

/** One catalogue module's translators: export name → its keys, each with its line. */
function catalogueKeys(file: string, source: string): Map<string, Map<string, number>> {
  const tree = parseTsx(file, source)
  const out = new Map<string, Map<string, number>>()
  for (const stmt of tree.program.body as Node[]) {
    if (stmt.type !== 'ExportNamedDeclaration' || !isNode(stmt.declaration)) continue
    for (const decl of (stmt.declaration.declarations ?? []) as Node[]) {
      const init = decl.init
      if (!isNode(init) || init.type !== 'CallExpression' || name(init.callee) !== 'messages') {
        continue
      }
      const exported = name(decl.id)
      const arg = (init.arguments as Node[])[0]
      if (!exported || !isNode(arg) || arg.type !== 'ObjectExpression') continue
      const keys = new Map<string, number>()
      for (const p of arg.properties as Node[]) {
        const key = isNode(p.key) ? (name(p.key) ?? p.key.value) : undefined
        if (typeof key === 'string') keys.set(key, tree.lineOf(p.start))
      }
      out.set(exported, keys)
    }
  }
  return out
}

/** The keys each translator is called with, by its exported name. */
function keysSaid(file: string, source: string): Map<string, Set<string>> {
  const tree = parseTsx(file, source)
  const translators = translatorImports(tree.program)
  const out = new Map<string, Set<string>>()
  walk(tree.program, (n) => {
    if (n.type !== 'CallExpression') return undefined
    const local = name(n.callee)
    const exported = local ? translators.get(local) : undefined
    if (!exported) return undefined
    const keys = literalKeys((n.arguments as unknown[])[0]) ?? []
    const set = out.get(exported) ?? new Set<string>()
    for (const k of keys) set.add(k)
    out.set(exported, set)
    return undefined
  })
  return out
}

const RULES: readonly Rule[] = [
  {
    id: 'hard-coded',
    rule: 'ADR-053 — a UI string typed at the call site instead of said from the message catalogue',
    fix: "add the words to the area's module in apps/web/src/messages/ (`messages({ key: 'Words {value}' })`) and say them by key (`areaCopy('key', { value })`)",
    mode: 'ratchet',
  },
  {
    id: 'catalogue',
    rule: 'ADR-053 — `messages(…)` only in apps/web/src/messages/, one export name per module, literal keys, no unsaid key',
    fix: 'move the module into apps/web/src/messages/; rename a clashing export; pass the key as a string literal (or a conditional between two); delete a key nothing says',
    mode: 'zero',
  },
]

function uiFiles(root: string): string[] {
  return listFiles(root, [UI_DIR], ['.ts', '.tsx']).filter((f) => !SKIP_FILE.test(f))
}

const inCatalogue = (f: string) => f.startsWith(`${CATALOGUE_DIR}/`)

/** Findings for a tree, given its files' sources. Pure. */
export function lintUiStrings(sources: ReadonlyMap<string, string>): Record<string, Finding[]> {
  const hardCoded: Finding[] = []
  const catalogue: Finding[] = []
  const declared = new Map<string, { file: string; keys: Map<string, number> }>()
  const said = new Map<string, Set<string>>()
  for (const [file, source] of sources) {
    if (inCatalogue(file)) {
      for (const [exported, keys] of catalogueKeys(file, source)) {
        const earlier = declared.get(exported)
        if (earlier) {
          catalogue.push({
            file,
            line: 1,
            detail: `${exported} is also exported by ${earlier.file}: one name per module`,
          })
        }
        declared.set(exported, { file, keys })
      }
      continue
    }
    const found = uiStringFindings(file, source)
    if (found.importsDefine) {
      catalogue.push({
        file,
        line: 1,
        detail: `messages(…) outside ${CATALOGUE_DIR}/: the catalogue is one place`,
      })
    }
    hardCoded.push(...found.hardCoded)
    catalogue.push(...found.computedKeys)
    for (const [exported, keys] of keysSaid(file, source)) {
      const set = said.get(exported) ?? new Set<string>()
      for (const k of keys) set.add(k)
      said.set(exported, set)
    }
  }
  for (const [exported, { file, keys }] of declared) {
    const used = said.get(exported) ?? new Set<string>()
    for (const [key, line] of keys) {
      if (!used.has(key)) {
        catalogue.push({ file, line, detail: `${exported}('${key}') is said nowhere: delete it` })
      }
    }
  }
  return { 'hard-coded': hardCoded, catalogue }
}

function readSources(root: string): Map<string, string> {
  return new Map(uiFiles(root).map((f) => [f, readFileSync(join(root, f), 'utf8')] as const))
}

/** Fewer files than this means the app's source moved (packages/gates/lib/scanFloor.ts). */
const FILE_FLOOR = 400

export const uiStrings: RuleSet = {
  id: 'ui-strings',
  label: 'ui-strings: the message catalogue',
  rules: RULES,
  preflight(root) {
    assertScanFloor('ui-strings', uiFiles(root).length, FILE_FLOOR)
  },
  scan: (root) => lintUiStrings(readSources(root)),
  exemptionsLive: 'packages/gates/rules/uiStrings.ts',
  summary(root) {
    const files = uiFiles(root)
    const catalogued = files.filter(inCatalogue).length
    return `${files.length} files, ${catalogued} catalogue modules`
  },
}
