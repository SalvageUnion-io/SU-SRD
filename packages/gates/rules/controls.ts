/**
 * Control laws — the `controls` rule set of `tools/check-rule-sets.ts`: the
 * icons and the switching controls of `docs/design-system/chrome.md`.
 *
 * ## Icons take their Size (hard rule R23, chrome K11)
 *
 * A glyph is its line's Size: Mini 12px, Compact 14px, Full 18px (`iconSize`
 * in `apps/web/src/design/tokens.ts`), at lucide's default stroke. Before this
 * the app drew lucide glyphs at eight sizes (12 to 28) and three strokes (2,
 * 2.5, 3), sized some by a `size` prop and some by a style object's width, so
 * two close buttons side by side could differ by 8px and nothing failed.
 *
 * - `icon-size`: every lucide glyph in `apps/web/src` (a name imported from
 *   `lucide-react`, or a local bound to one: `const Glyph = open ? ChevronDown
 *   : ChevronRight`) names its Size, `size={iconSize.…}` (or
 *   `tokens.iconSize.…`), and sets no `strokeWidth`, `absoluteStrokeWidth`,
 *   `width` or `height`.
 *
 * `zero`. A glyph handed on as a component (`icon: ChevronDown`) is checked
 * where it is drawn only when that file imports it; the drawing component
 * passes `iconSize` itself.
 *
 * ## Tabs, Segmented, Toggle by job (hard rule R29, chrome K10)
 *
 * `Tabs` switch what a region shows, `Segmented` sets a value, `Toggle` is one
 * on/off. Six controls overlapped before this: Tabs, a Tab-look `Toggle` in a
 * `ToggleGroup`, Segmented, HeaderMenu's own `aria-pressed` segment, the
 * searcher's `aria-pressed` Badge pills and hand-made pressed buttons, so a
 * reader met the same job drawn three ways.
 *
 * - `tab-role`: `role="tablist"` or `role="tab"` only in `Tabs` (Base UI's).
 * - `pressed`: `aria-pressed` only in `Segmented` (the options of a value) and
 *   `Toggle` (one on/off), bar `ONE_ON_OFF`: each a single control's pressed
 *   state that another rule owns (a picker card's select is R15's).
 *
 * Both `zero`, read from the AST, so a comment may name what it bans. The
 * Union bar's Reference | Build | Play is navigation (links, `aria-current`),
 * neither.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSync } from 'oxc-parser'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

const SRC = 'apps/web/src'

const isTest = (rel: string) => rel.includes('/__tests__/') || /\.test\.tsx?$/.test(rel)

type Node = { type?: unknown; start?: number; end?: number; [k: string]: unknown }
const isNode = (v: unknown): v is Node => !!v && typeof v === 'object' && !Array.isArray(v)

/** Every node under `v`, depth first. */
function* nodes(v: unknown): Generator<Node> {
  if (Array.isArray(v)) {
    for (const x of v) yield* nodes(x)
    return
  }
  if (!isNode(v)) return
  yield v
  for (const [k, x] of Object.entries(v)) if (k !== 'parent') yield* nodes(x)
}

function lineOf(source: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < source.length; i++) if (source[i] === '\n') line++
  return line
}

const identifiers = (v: unknown): Set<string> => {
  const out = new Set<string>()
  for (const n of nodes(v))
    if (n.type === 'Identifier' && typeof n.name === 'string') out.add(n.name)
  return out
}

/**
 * The names a file draws lucide glyphs by: its `lucide-react` value imports,
 * then every non-function local whose initialiser reaches one, to a fixpoint
 * (`EMPTY_GLYPH` of `{ pilot: UserRound }`, then `Glyph = EMPTY_GLYPH[kind]`).
 */
export function lucideNames(program: unknown): Set<string> {
  const names = new Set<string>()
  for (const n of nodes(program)) {
    if (n.type !== 'ImportDeclaration' || n.importKind === 'type') continue
    if (!isNode(n.source) || n.source.value !== 'lucide-react') continue
    for (const s of (n.specifiers as Node[]) ?? []) {
      if (s.importKind === 'type') continue
      if (isNode(s.local) && typeof s.local.name === 'string') names.add(s.local.name)
    }
  }
  if (names.size === 0) return names
  const declarators = [...nodes(program)].filter(
    (n) =>
      n.type === 'VariableDeclarator' &&
      isNode(n.id) &&
      n.id.type === 'Identifier' &&
      isNode(n.init) &&
      n.init.type !== 'ArrowFunctionExpression' &&
      n.init.type !== 'FunctionExpression'
  )
  let grew = true
  while (grew) {
    grew = false
    for (const d of declarators) {
      const id = (d.id as Node).name as string
      if (names.has(id)) continue
      if ([...identifiers(d.init)].some((x) => names.has(x))) {
        names.add(id)
        grew = true
      }
    }
  }
  return names
}

const BANNED_ICON_PROPS = new Set(['strokeWidth', 'absoluteStrokeWidth', 'width', 'height'])

/** Every lucide glyph in one source file whose Size is not `iconSize`'s. Pure. */
export function iconSizeFindings(file: string, source: string): Finding[] {
  const program = parseSync(file, source).program
  const names = lucideNames(program)
  if (names.size === 0) return []
  const out: Finding[] = []
  for (const n of nodes(program)) {
    if (n.type !== 'JSXOpeningElement' || !isNode(n.name)) continue
    if (n.name.type !== 'JSXIdentifier' || !names.has(n.name.name as string)) continue
    const glyph = n.name.name as string
    const line = lineOf(source, n.start ?? 0)
    let sized = false
    for (const a of (n.attributes as Node[]) ?? []) {
      if (a.type !== 'JSXAttribute' || !isNode(a.name)) continue
      const prop = a.name.name as string
      if (BANNED_ICON_PROPS.has(prop)) {
        out.push({
          file,
          line,
          detail: `<${glyph} ${prop}>: the stroke is lucide's 2 and the size is \`size\``,
        })
      }
      if (prop !== 'size') continue
      const value = source.slice(
        (a.value as Node | null)?.start ?? 0,
        (a.value as Node | null)?.end ?? 0
      )
      if (/\biconSize\b/.test(value)) sized = true
      else out.push({ file, line, detail: `<${glyph} size=${value}>: not an \`iconSize\`` })
      sized = true
    }
    if (!sized) out.push({ file, line, detail: `<${glyph}> names no Size: pass size={iconSize.…}` })
  }
  return out
}

function scanIconSize(root: string): Finding[] {
  const out: Finding[] = []
  for (const rel of listFiles(root, [SRC], ['.tsx'])) {
    if (isTest(rel)) continue
    const source = readFileSync(join(root, rel), 'utf8')
    if (!source.includes('lucide-react')) continue
    out.push(...iconSizeFindings(rel, source))
  }
  return out
}

/** The one home of each switching role. */
const TABS_HOME = 'apps/web/src/components/atoms/Tabs.tsx'
const PRESSED_HOMES = new Set([
  'apps/web/src/components/atoms/Segmented.tsx',
  'apps/web/src/components/atoms/Toggle.tsx',
])

/**
 * A single control's own pressed state, each with the rule that owns it: not
 * a group of options, so not Segmented's, and drawn in another look than
 * `Toggle`'s for a reason written here. Delete an entry when its owner lands:
 * an entry whose file sets no `aria-pressed` any more is itself a finding.
 */
export const ONE_ON_OFF: Record<string, string> = {
  'apps/web/src/build/sheet/UsedToggle.tsx':
    "Mark used: a pencil one on/off (dashed means editable), the sheet's (R11)",
  'apps/web/src/components/containers/Sel.tsx': "a selectable card's select state (R15)",
  'apps/web/src/components/referenceEntity/card/cardChrome.ts':
    "a reference card's select toggle (R15)",
  'apps/web/src/components/referenceEntity/choiceCard/ChoiceGroups.tsx':
    "a choice card's chosen state (R15)",
}

/** Every JSX attribute or object key `name` in one file, with its value's source. */
function attributes(source: string, program: unknown, name: string) {
  const out: { line: number; value: string }[] = []
  for (const n of nodes(program)) {
    const isAttr = n.type === 'JSXAttribute' && isNode(n.name) && n.name.name === name
    const isKey =
      n.type === 'Property' &&
      isNode(n.key) &&
      (n.key.value === name || (n.key.type === 'Identifier' && n.key.name === name))
    if (!isAttr && !isKey) continue
    const value = n.value as Node | null
    out.push({
      line: lineOf(source, n.start ?? 0),
      value: value ? source.slice(value.start ?? 0, value.end ?? 0) : '',
    })
  }
  return out
}

type SwitchingFindings = { 'tab-role': Finding[]; pressed: Finding[] }

const TAB_ROLE = /^\{?\s*["'`]tab(?:list)?["'`]\s*\}?$/

/** `role="tablist"` / `role="tab"` outside Tabs, and `aria-pressed` outside its homes. Pure. */
export function switchingFindings(file: string, source: string): SwitchingFindings {
  const found: SwitchingFindings = { 'tab-role': [], pressed: [] }
  if (!/role|aria-pressed/.test(source)) return found
  const program = parseSync(file, source).program
  if (file !== TABS_HOME) {
    for (const { line, value } of attributes(source, program, 'role')) {
      if (TAB_ROLE.test(value)) {
        found['tab-role'].push({ file, line, detail: `role=${value}: a tab row is Tabs` })
      }
    }
  }
  if (!PRESSED_HOMES.has(file) && !(file in ONE_ON_OFF)) {
    for (const { line, value } of attributes(source, program, 'aria-pressed')) {
      found.pressed.push({ file, line, detail: `aria-pressed=${value}` })
    }
  }
  return found
}

function scanSwitching(root: string): SwitchingFindings {
  const out: SwitchingFindings = { 'tab-role': [], pressed: [] }
  for (const rel of listFiles(root, [SRC], ['.ts', '.tsx'])) {
    if (isTest(rel)) continue
    const found = switchingFindings(rel, readFileSync(join(root, rel), 'utf8'))
    out['tab-role'].push(...found['tab-role'])
    out.pressed.push(...found.pressed)
  }
  for (const file of Object.keys(ONE_ON_OFF)) {
    const path = join(root, file)
    const source = existsSync(path) ? readFileSync(path, 'utf8') : ''
    if (attributes(source, parseSync(file, source).program, 'aria-pressed').length === 0) {
      out.pressed.push({
        file,
        line: 1,
        detail: 'a stale ONE_ON_OFF entry: it sets no aria-pressed',
      })
    }
  }
  return out
}

type ControlRule = Rule & { scan: (root: string) => Finding[] }

const RULES: ControlRule[] = [
  {
    id: 'icon-size',
    mode: 'zero',
    rule: "hard rule R23 (chrome K11) — an icon is its line's Size, `iconSize` (Mini 12, Compact 14, Full 18), at lucide's stroke 2",
    fix: 'Pass `size={iconSize.mini|compact|full}` (`tokens.iconSize` through the components index), the Size of the line the glyph sits on, and drop `strokeWidth`, `width`, `height` and any style-object width.',
    scan: scanIconSize,
  },
  {
    id: 'tab-role',
    mode: 'zero',
    rule: 'hard rule R29 (chrome K10) — a row of tabs switches what a region shows, and is `Tabs`: `role="tablist"` and `role="tab"` live only in Tabs.tsx',
    fix: 'Compose `Tabs` › `TabList` › `Tab`, one `TabPanel` per tab. If the row sets a value rather than switching a region, it is a `Segmented`.',
    scan: (root) => scanSwitching(root)['tab-role'],
  },
  {
    id: 'pressed',
    mode: 'zero',
    rule: 'hard rule R29 (chrome K10) — `aria-pressed` lives only in `Segmented` (options that set a value) and `Toggle` (one on/off)',
    fix: 'A row of options is `Segmented` › `SegmentedOption` (`wrap` for many); one on/off is `Toggle`. A single control another rule owns goes in ONE_ON_OFF (packages/gates/rules/controls.ts) with that rule named.',
    scan: (root) => scanSwitching(root).pressed,
  },
]

export const controlLaws: RuleSet = {
  id: 'controls',
  label: 'control laws',
  rules: RULES,
  exemptionsLive: 'packages/gates/rules/controls.ts (ONE_ON_OFF)',
  preflight(root) {
    // A catastrophe floor far below today's ~30 files that draw a lucide glyph.
    const drawing = listFiles(root, [SRC], ['.tsx']).filter((rel) =>
      readFileSync(join(root, rel), 'utf8').includes('lucide-react')
    )
    assertScanFloor('controls (lucide glyphs)', drawing.length, 15)
  },
  scan(root) {
    const out: Record<string, Finding[]> = {}
    for (const rule of RULES) out[rule.id] = rule.scan(root)
    return out
  },
}
