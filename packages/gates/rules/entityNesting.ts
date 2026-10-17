/**
 * How entities nest — the `entity-nesting` rule set of `tools/check-rule-sets.ts`.
 *
 * The incident: the nested-frames audit of 17 Oct 2026
 * (https://claude.ai/artifact/Lu1VzHVBbKJZ7pwkUbLozP). A `TitledBox`, an
 * entity Row and a Card head all draw the same cut-out head, and they stacked
 * up to four deep: eleven titled boxes inside the bay cards of one crawler
 * sheet, a framed card for every action at any depth (inside a Peek too), a
 * head-only Row wherever a card asked for its compact head. The canon now
 * has hard rules for it (ruleset §5, EDL E6; N1–N7), and three of them have a
 * shape in the source this set can see:
 *
 *   - **N2 header-only is a Token** (`head-only-token`) — an entity drawn as
 *     its head alone is a Token; a Row or Card keeps its body. The finding is
 *     a Row form (`<Row>`, `<Entity form="row">`) drawn inside an entity's own
 *     components (`components/referenceEntity/`, `components/entity/`, the
 *     form layer that defines the forms aside), and, while the card adapter
 *     (`ReferenceEntityCard`) can still draw a Row, every `extent="head"`
 *     that does not ask for the Token (`size="mini"`).
 *   - **N5 no titled box inside an entity** (`no-titled-box`) — a `TitledBox`,
 *     `Inset`, `InfoCutout`, `RecoveryPanel` or labelled `Callout` drawn in an
 *     entity's own components, or reaching a card's `expand` /
 *     `afterExtraContent` slot, directly, through a local (`{crew}`), or
 *     through a component that draws one (`NpcInset` → `Inset`).
 *   - **N3 nested actions** (`nested-card-level`) — the nested-group module
 *     (`NestedCards.tsx`: `InlineActions`, `NestedCardList`, `DroneCards`)
 *     draws a nested Card only for a Page's children (level 1); below it, a
 *     Token.
 *
 * ## Level 1 is spelled `onPage`
 *
 * A Page is level 0, so what it draws is level 1, where a compact Card, a Row
 * and a titled section (When Damaged on a bay's own page) are all fine. The
 * rule reads that from the code's own guard: an element under `onPage`
 * (`if (onPage)`, `host.onPage ? … :`, `onPage && …`), past an early
 * `if (nestsTokens(host)) return …`, or on a card with `presentation="page"`
 * is level 1. A dialog is level 0 again: whatever sits in a `*.Portal`, or
 * in a component that portals its children (`ModalShell`), is not inside the
 * entity that opened it.
 *
 * ## What it does not see
 *
 * Values that flow through props across files (a bay's `contents` prop
 * filled by the crawler sheet). And it reads no condition but the page: a
 * component that draws a titled box under any other (`side === 'mech'`)
 * counts as drawing it always, so a level-1 box and a nested block belong in
 * two components, not one switched by a prop. The runtime gate,
 * `apps/web/e2e/nesting-depth.e2e.ts`, measures what renders.
 *
 * Every rule is `zero`. The owner's call (2026-10-17) was strict gates with
 * nothing allowlisted, so `EXEMPTIONS` is empty; an entry needs a reason.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Node, TsxFile } from '../lib/jsxTree'
import {
  attribute,
  attributeValue,
  componentOf,
  elementName,
  isNode,
  parseTsx,
  stringValues,
  unwrap,
  walk,
} from '../lib/jsxTree'
import type { Exemption, Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { isExempt, listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'
import { assertCoversWorkspaces } from '../lib/workspaceCoverage'

const SRC = 'apps/web/src'
const COMPONENTS = `${SRC}/components`
/** An entity's own components: what they draw is inside the entity. */
const ENTITY_DIRS = [`${COMPONENTS}/referenceEntity/`, `${COMPONENTS}/entity/`] as const
/** The form layer defines Row and Token; drawing them there is not nesting. */
const FORM_LAYER = [`${COMPONENTS}/entity/forms/`, `${COMPONENTS}/entity/Entity.tsx`] as const
/** The card adapter: its head extent is the head-only form. */
export const ADAPTER = `${COMPONENTS}/referenceEntity/card/ReferenceEntityCard.tsx`
/** The nested-group module: where a card decides how its children draw. */
export const NESTED_GROUPS = `${COMPONENTS}/referenceEntity/card/NestedCards.tsx`

/** The titled boxes (ruleset N5); a `Callout` is one only with a `label`. */
const TITLED = new Set(['TitledBox', 'Inset', 'InfoCutout', 'RecoveryPanel'])
/** A card's slots for content of the caller's: inside the card's frame. */
const SLOTS = ['expand', 'afterExtraContent'] as const
/** The cards whose `extent` and `size` pick the form. */
const CARDS = new Set(['ReferenceEntityCard', 'NestedCard'])

/**
 * Sanctioned exceptions: none. The milestone that wrote these rules fixed
 * every finding instead (owner, 2026-10-17). An entry needs a written reason.
 */
const EXEMPTIONS: Exemption[] = []

// ── the corpus ──────────────────────────────────────────────────────────────

type Corpus = { files: TsxFile[] }

const isTest = (rel: string) => rel.split('/').includes('__tests__') || /\.test\.tsx$/.test(rel)
const inEntityDirs = (rel: string) => ENTITY_DIRS.some((d) => rel.startsWith(d))
const inFormLayer = (rel: string) => FORM_LAYER.some((d) => rel.startsWith(d))

function sourceFiles(root: string): string[] {
  return listFiles(root, [SRC], ['.tsx']).filter((rel) => !isTest(rel))
}

function corpus(root: string): Corpus {
  return {
    files: sourceFiles(root).map((rel) => parseTsx(rel, readFileSync(join(root, rel), 'utf8'))),
  }
}

// ── level 1: the page guard ─────────────────────────────────────────────────

type Level = 'page' | 'nested' | null

/**
 * What `expr` being `truthy` says about the level: `onPage` (or `x.onPage`,
 * `presentation === 'page'`) true is a Page's child, `nestsTokens(…)` true is
 * not. `!`, `&&` and `||` are followed; a local alias once.
 */
function levelWhen(expr: Node, truthy: boolean, file: TsxFile, depth = 0): Level {
  const e = unwrap(expr)
  const atom = (onPage: boolean): Level => (onPage === truthy ? 'page' : 'nested')
  if (e.type === 'Identifier') {
    if (e.name === 'onPage') return atom(true)
    const alias = depth === 0 ? file.bindings.get(String(e.name)) : undefined
    return alias?.length === 1 && alias[0] ? levelWhen(alias[0], truthy, file, 1) : null
  }
  if (e.type === 'MemberExpression' && isNode(e.property) && !e.computed) {
    return e.property.name === 'onPage' ? atom(true) : null
  }
  if (e.type === 'CallExpression' && isNode(e.callee) && e.callee.type === 'Identifier') {
    return e.callee.name === 'nestsTokens' ? atom(false) : null
  }
  if (e.type === 'UnaryExpression' && e.operator === '!' && isNode(e.argument)) {
    return levelWhen(e.argument, !truthy, file, depth)
  }
  if (e.type === 'BinaryExpression' && isNode(e.left) && isNode(e.right)) {
    const eq = e.operator === '===' ? true : e.operator === '!==' ? false : null
    const left = unwrap(e.left)
    const isPresentation =
      (left.type === 'Identifier' && left.name === 'presentation') ||
      (left.type === 'MemberExpression' &&
        isNode(left.property) &&
        left.property.name === 'presentation')
    const right = unwrap(e.right)
    if (eq === null || !isPresentation || right.type !== 'Literal' || right.value !== 'page')
      return null
    return atom(eq)
  }
  if (
    e.type === 'LogicalExpression' &&
    (e.operator === '&&' || e.operator === '||') &&
    isNode(e.left) &&
    isNode(e.right)
  ) {
    const l = levelWhen(e.left, truthy, file, depth)
    const r = levelWhen(e.right, truthy, file, depth)
    // `a && b` true: both are; `a || b` false: neither is. Either side decides.
    const either = (e.operator === '&&') === truthy
    if (either) return l ?? r
    return l === r ? l : null
  }
  return null
}

/** A statement no code runs past: `return`, `throw`, or a block ending in one. */
function exits(stmt: unknown): boolean {
  if (!isNode(stmt)) return false
  if (stmt.type === 'ReturnStatement' || stmt.type === 'ThrowStatement') return true
  if (stmt.type === 'BlockStatement' && Array.isArray(stmt.body)) return exits(stmt.body.at(-1))
  return false
}

/** Is the node (with its ancestors) drawn only for a Page's children: level 1? */
function onPageGuarded(node: Node, ancestors: readonly Node[], file: TsxFile): boolean {
  let child = node
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i] as Node
    const test = isNode(a.test) ? a.test : null
    if ((a.type === 'ConditionalExpression' || a.type === 'IfStatement') && test) {
      if (child === a.consequent && levelWhen(test, true, file) === 'page') return true
      if (child === a.alternate && levelWhen(test, false, file) === 'page') return true
    }
    if (a.type === 'LogicalExpression' && child === a.right && isNode(a.left)) {
      const truthy = a.operator === '&&' ? true : a.operator === '||' ? false : null
      if (truthy !== null && levelWhen(a.left, truthy, file) === 'page') return true
    }
    if (a.type === 'JSXElement' && pagePresentation(a)) return true
    if (Array.isArray(a.body)) {
      // Past an early exit for every other level (`if (nestsTokens(host)) return …`),
      // the code runs only when the test was false: on a Page.
      for (const stmt of a.body as unknown[]) {
        if (stmt === child) break
        if (
          isNode(stmt) &&
          stmt.type === 'IfStatement' &&
          !stmt.alternate &&
          isNode(stmt.test) &&
          exits(stmt.consequent) &&
          levelWhen(stmt.test, false, file) === 'page'
        ) {
          return true
        }
      }
    }
    child = a
  }
  return false
}

/** A card that IS a Page (`presentation="page"`): its content is level 1. */
function pagePresentation(element: Node): boolean {
  const attr = attribute(element, 'presentation')
  if (!attr) return false
  const { values, open } = stringValues(attributeValue(attr))
  return !open && values.length > 0 && values.every((v) => v === 'page')
}

/**
 * A dialog or popup draws at level 0 again, wherever it is opened from: what
 * sits in a `*.Portal`, or in a component that portals its children
 * (`ModalShell`), is not inside the entity that opened it.
 */
function portalled(element: Node, portals: ReadonlySet<string>): boolean {
  const name = elementName(element)
  return /(^|\.)Portal$/.test(name) || portals.has(name)
}

const inPortal = (ancestors: readonly Node[], portals: ReadonlySet<string>) =>
  ancestors.some((a) => a.type === 'JSXElement' && portalled(a, portals))

/** Components that draw a `*.Portal` or call `createPortal`: the dialogs and popups. */
function portalComponents(c: Corpus): Set<string> {
  const out = new Set<string>()
  for (const file of c.files) {
    walk(file.program, (node, ancestors) => {
      const portal =
        (node.type === 'JSXElement' && /(^|\.)Portal$/.test(elementName(node))) ||
        (node.type === 'CallExpression' &&
          isNode(node.callee) &&
          node.callee.name === 'createPortal')
      const component = portal ? componentOf(ancestors) : null
      if (component) out.add(component)
      return undefined
    })
  }
  return out
}

// ── what draws a titled box ─────────────────────────────────────────────────

/**
 * Components that draw a titled box, found across the tree: `always` for one
 * drawn under no page guard (`NpcInset` → `Inset`), `onPage` for one drawn
 * only on a Page (`DamagedEffectCallout`), which titles only when told
 * `onPage`. `portals` are the dialogs, whose content is level 0.
 */
type TitledComponents = { always: Set<string>; onPage: Set<string>; portals: Set<string> }

/** Is this element one of the titled boxes themselves (a labelled Callout among them)? */
function titledBox(element: Node): boolean {
  const name = elementName(element)
  if (TITLED.has(name)) return true
  if (name !== 'Callout') return false
  const label = attribute(element, 'label')
  const value = label ? attributeValue(label) : undefined
  return !!label && !(value && value.type === 'Identifier' && value.name === 'undefined')
}

/** Does this element draw a titled box, itself or through a component, given what is known so far? */
function titledElement(element: Node, known: TitledComponents): boolean {
  const name = elementName(element)
  if (titledBox(element)) return true
  if (known.always.has(name)) return true
  if (known.onPage.has(name)) {
    const flag = attribute(element, 'onPage')
    if (!flag) return false
    const value = attributeValue(flag)
    return value === null || (value.type === 'Literal' && value.value === true)
  }
  return false
}

/** Told `onPage={…}` by its host: titled exactly when the host is on a Page. */
function forwardsOnPage(element: Node, known: TitledComponents, file: TsxFile): boolean {
  const flag = attribute(element, 'onPage')
  const value = flag ? attributeValue(flag) : undefined
  return (
    known.onPage.has(elementName(element)) &&
    !!value &&
    value.type !== 'Literal' &&
    levelWhen(value, true, file) === 'page'
  )
}

function titledComponents(c: Corpus): TitledComponents {
  const portals = portalComponents(c)
  type Draw = { file: TsxFile; component: string; element: Node; guarded: boolean }
  const draws: Draw[] = []
  for (const file of c.files) {
    walk(file.program, (node, ancestors) => {
      if (node.type !== 'JSXElement' || inPortal(ancestors, portals)) return undefined
      const component = componentOf(ancestors)
      if (component && !TITLED.has(component) && component !== 'Callout') {
        draws.push({
          file,
          component,
          element: node,
          guarded: onPageGuarded(node, ancestors, file),
        })
      }
      return undefined
    })
  }
  const known: TitledComponents = { always: new Set(), onPage: new Set(), portals }
  for (let changed = true; changed; ) {
    changed = false
    for (const { file, component, element, guarded } of draws) {
      if (known.always.has(component)) continue
      const forwarded = forwardsOnPage(element, known, file)
      if (!forwarded && !titledElement(element, known)) continue
      if (guarded || forwarded) {
        if (known.onPage.has(component)) continue
        known.onPage.add(component)
      } else {
        known.onPage.delete(component)
        known.always.add(component)
      }
      changed = true
    }
  }
  return known
}

// ── N5: no titled box inside an entity ──────────────────────────────────────

function why(element: Node): string {
  const name = elementName(element)
  if (name === 'Callout') return 'a labelled Callout'
  return TITLED.has(name) ? `a ${name}` : `${name}, which draws a titled box`
}

/** Every element a slot's expression reaches: through locals, calls and children. */
function slotElements(expr: Node, file: TsxFile, portals: ReadonlySet<string>): Node[] {
  const out: Node[] = []
  const seen = new Set<Node>()
  const visit = (n: Node) => {
    if (seen.has(n)) return
    seen.add(n)
    walk(n, (node) => {
      if (node.type === 'JSXElement') {
        if (portalled(node, portals)) return false
        out.push(node)
      } else if (node.type === 'Identifier') {
        for (const bound of file.bindings.get(String(node.name)) ?? []) visit(bound)
      }
      return undefined
    })
  }
  visit(expr)
  return out
}

function scanTitledBoxes(c: Corpus, known: TitledComponents): Finding[] {
  const out = new Map<string, Finding>()
  const add = (file: TsxFile, element: Node, detail: string) => {
    if (isExempt(EXEMPTIONS, file.rel, 'no-titled-box')) return
    const line = file.lineOf(element.start)
    out.set(`${file.rel}:${line}`, { file: file.rel, line, detail })
  }
  for (const file of c.files) {
    const own = inEntityDirs(file.rel)
    walk(file.program, (node, ancestors) => {
      if (node.type !== 'JSXElement') return undefined
      if (inPortal(ancestors, known.portals)) return false
      const component = componentOf(ancestors)
      // A titled box's own definition composing another is not a nesting.
      if (own && !(component && TITLED.has(component)) && titledBox(node)) {
        if (!onPageGuarded(node, ancestors, file))
          add(file, node, `${why(node)} drawn in an entity's own component`)
      }
      if (pagePresentation(node)) return undefined
      for (const slot of SLOTS) {
        const attr = attribute(node, slot)
        const expr = attr ? attributeValue(attr) : null
        if (!expr) continue
        for (const inner of slotElements(expr, file, known.portals)) {
          if (titledElement(inner, known))
            add(file, inner, `${why(inner)} in <${elementName(node)}>'s \`${slot}\` slot`)
        }
      }
      return undefined
    })
  }
  return [...out.values()]
}

// ── N2: header-only is a Token ──────────────────────────────────────────────

/** A Row form: `<Row>`, or `<Entity form="row">` (or a form that may be). */
function rowForm(element: Node): boolean {
  const name = elementName(element)
  if (name === 'Row') return true
  if (name !== 'Entity') return false
  const form = attribute(element, 'form')
  return !!form && stringValues(attributeValue(form)).values.includes('row')
}

/** `extent` may be `'head'` while `size` is not certainly `'mini'`. */
function headWithoutMini(extent: Node | null, size: Node | null | undefined): boolean {
  if (!stringValues(extent).values.includes('head')) return false
  if (size === undefined) return true
  const { values, open } = stringValues(size)
  return open || values.length === 0 || values.some((v) => v !== 'mini')
}

function adapterDrawsRow(c: Corpus): boolean {
  const adapter = c.files.find((f) => f.rel === ADAPTER)
  let draws = false
  if (adapter) {
    walk(adapter.program, (node) => {
      if (node.type === 'JSXElement' && rowForm(node)) draws = true
      return undefined
    })
  }
  return draws
}

function scanHeadOnly(c: Corpus, known: TitledComponents): Finding[] {
  const out: Finding[] = []
  const rowHeads = adapterDrawsRow(c)
  for (const file of c.files) {
    if (isExempt(EXEMPTIONS, file.rel, 'head-only-token')) continue
    const nested = inEntityDirs(file.rel) && !inFormLayer(file.rel)
    walk(file.program, (node, ancestors) => {
      const line = () => file.lineOf(node.start)
      if (node.type === 'JSXElement') {
        if (nested && rowForm(node) && !inPortal(ancestors, known.portals)) {
          const detail =
            file.rel === ADAPTER ? 'the card adapter draws a Row' : 'a Row drawn inside an entity'
          if (!onPageGuarded(node, ancestors, file))
            out.push({ file: file.rel, line: line(), detail })
        }
        const extent = attribute(node, 'extent')
        const size = attribute(node, 'size')
        if (
          rowHeads &&
          CARDS.has(elementName(node)) &&
          extent &&
          headWithoutMini(attributeValue(extent), size ? attributeValue(size) : undefined)
        ) {
          out.push({
            file: file.rel,
            line: line(),
            detail: `<${elementName(node)} extent="head"> without size="mini": the adapter draws it as a head-only Row`,
          })
        }
      }
      // The fold: `resolveCardDisplay({ size, extent: folded ? 'head' : extent })`.
      if (
        rowHeads &&
        node.type === 'CallExpression' &&
        isNode(node.callee) &&
        node.callee.name === 'resolveCardDisplay'
      ) {
        const arg = Array.isArray(node.arguments) ? node.arguments[0] : undefined
        const props = isNode(arg) && Array.isArray(arg.properties) ? arg.properties : []
        const prop = (key: string): Node | null | undefined => {
          const p = (props as unknown[]).find(
            (x): x is Node => isNode(x) && isNode(x.key) && x.key.name === key
          )
          return p && isNode(p.value) ? p.value : undefined
        }
        const extent = prop('extent')
        if (extent && headWithoutMini(extent, prop('size'))) {
          out.push({
            file: file.rel,
            line: line(),
            detail: 'a card display resolved to extent "head" without size "mini": a head-only Row',
          })
        }
      }
      return undefined
    })
  }
  return out
}

// ── N3: nested cards only at level 1 ────────────────────────────────────────

function scanNestedCardLevel(c: Corpus, known: TitledComponents): Finding[] {
  const file = c.files.find((f) => f.rel === NESTED_GROUPS)
  if (!file || isExempt(EXEMPTIONS, file.rel, 'nested-card-level')) return []
  const out: Finding[] = []
  walk(file.program, (node, ancestors) => {
    if (node.type !== 'JSXElement' || elementName(node) !== 'NestedCard') return undefined
    // A Page in a dialog is level 0; a head is a Token (N2 checks that).
    if (pagePresentation(node) || inPortal(ancestors, known.portals)) return undefined
    const extent = attribute(node, 'extent')
    const { values, open } = stringValues(extent ? attributeValue(extent) : null)
    if (extent && !open && values.every((v) => v === 'head')) return undefined
    if (onPageGuarded(node, ancestors, file)) return undefined
    out.push({
      file: file.rel,
      line: file.lineOf(node.start),
      detail: `a NestedCard drawn below level 1 (in ${componentOf(ancestors) ?? 'module scope'})`,
    })
    return undefined
  })
  return out
}

// ── rule table ──────────────────────────────────────────────────────────────

type NestingRule = Rule & { scan: (c: Corpus, known: TitledComponents) => Finding[] }

const RULES: NestingRule[] = [
  {
    id: 'head-only-token',
    mode: 'zero',
    rule: 'ruleset §5 N2 (EDL E3, E6): only a Token draws an entity as its head alone; inside an entity, a nested entity is a Token',
    fix: 'Follow N2: draw the head as a Token (`<Entity form="token">`, or `size="mini" extent="head"`), and keep the adapter (ReferenceEntityCard) drawing every head as a Token. A Row belongs at level 1 only, under `onPage` (N1).',
    scan: scanHeadOnly,
  },
  {
    id: 'no-titled-box',
    mode: 'zero',
    rule: 'ruleset §5 N5: no titled box (TitledBox, Inset, InfoCutout, RecoveryPanel, a labelled Callout) inside an entity',
    fix: "Follow N5: a section of the parent is a Slab over its content (When Damaged, the Crawler Hold); a note is an unlabelled Callout; a nested entity is a contentful Token (N3). On the entity's own Page, level 1, a block may stay titled under `onPage`.",
    scan: scanTitledBoxes,
  },
  {
    id: 'nested-card-level',
    mode: 'zero',
    rule: "ruleset §5 N3 (N1): InlineActions and the nested groups draw a NestedCard only for a Page's children, level 1",
    fix: 'Follow N3: below level 1 a nested action or entity is a (contentful) Token. Return the Tokens first (`if (nestsTokens(host)) return …`) and draw the NestedCard only after, for a Page.',
    scan: scanNestedCardLevel,
  },
]

// ── preconditions ───────────────────────────────────────────────────────────

function preflight(root: string): void {
  const files = sourceFiles(root)
  // Catastrophe floors (scanFloor.ts), far below today's ~440 components and
  // ~57 in the entity trees.
  assertScanFloor('entity-nesting (components)', files.length, 250)
  assertScanFloor('entity-nesting (entity components)', files.filter(inEntityDirs).length, 30)
  // The two files whose shape the N2 and N3 rules read: a rename would leave
  // those rules scanning nothing.
  assertScanFloor('entity-nesting (the card adapter)', files.includes(ADAPTER) ? 1 : 0, 1)
  assertScanFloor('entity-nesting (the nested groups)', files.includes(NESTED_GROUPS) ? 1 : 0, 1)
  // Entity components exist in one workspace; every other one says why not
  // (packages/gates/lib/workspaceCoverage.ts).
  assertCoversWorkspaces('entity nesting', [SRC], {
    'apps/discord-bot':
      'renders Discord Components V2 containers, not React components: no entity cards to nest.',
    'apps/su-assets': 'a Worker that serves image bytes and short error strings; no components.',
    'packages/cantina-domain': 'schemas and rules shared with Convex and the bot; no components.',
    'packages/salvageunion-reference':
      'data, the ORM and the entity model the cards read; no components.',
    'packages/gates': 'the gates themselves: the fixtures quote the shapes they forbid.',
  })
}

export const entityNesting: RuleSet = {
  id: 'entity-nesting',
  label: 'entity nesting',
  rules: RULES,
  exemptionsLive: 'packages/gates/rules/entityNesting.ts',
  preflight,
  scan(root) {
    const c = corpus(root)
    const known = titledComponents(c)
    const out: Record<string, Finding[]> = {}
    for (const rule of RULES) out[rule.id] = rule.scan(c, known)
    return out
  },
  summary: (root) => {
    const files = sourceFiles(root)
    return `${files.length} components, ${files.filter(inEntityDirs).length} in the entity trees`
  },
}
