/**
 * A TSX file as a tree a JSX rule can ask questions of: the parse, a walk that
 * hands each node its ancestors, a JSX element's name and attributes, the
 * string values an expression can take, and the file's own bindings by name.
 *
 * The `entity-nesting` rule set (`rules/entityNesting.ts`) reads components
 * this way because what it checks is a shape, not a spelling: which element
 * sits inside which, under which condition. A line regex cannot see that a
 * `TitledBox` is the consequent of `if (onPage)`, or that a slot's
 * `{crew}` is a local whose value is an `NpcInset`.
 */

import { parseSync } from 'oxc-parser'

export type Node = { type: string; start: number; end: number; [k: string]: unknown }

export const isNode = (v: unknown): v is Node =>
  !!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as Node).type === 'string'

export type TsxFile = {
  /** Repo-relative path. */
  rel: string
  program: Node
  /** 1-based line of a source offset. */
  lineOf: (offset: number) => number
  /**
   * What each name is bound to anywhere in the file: a variable's initialiser
   * or a function declaration. Scopes are flattened, which is close enough
   * for following a slot's `{crew}` back to the JSX it holds.
   */
  bindings: Map<string, Node[]>
}

/** The node's children, in source order (`parent` back-links skipped). */
function childNodes(node: Node): Node[] {
  const out: Node[] = []
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) out.push(item)
    } else if (isNode(value)) {
      out.push(value)
    }
  }
  return out
}

/**
 * Depth-first walk. `visit` gets each node and its ancestors, outermost
 * first; returning `false` skips the node's subtree.
 */
export function walk(
  node: Node,
  visit: (node: Node, ancestors: readonly Node[]) => boolean | undefined,
  ancestors: Node[] = []
): void {
  if (visit(node, ancestors) === false) return
  ancestors.push(node)
  for (const child of childNodes(node)) walk(child, visit, ancestors)
  ancestors.pop()
}

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

/** Parse one TSX source. Pure: the caller reads the file. */
export function parseTsx(rel: string, source: string): TsxFile {
  const program = parseSync(rel, source).program as unknown as Node
  const bindings = new Map<string, Node[]>()
  const bind = (name: unknown, value: unknown) => {
    if (typeof name !== 'string' || !isNode(value)) return
    bindings.set(name, [...(bindings.get(name) ?? []), value])
  }
  walk(program, (node) => {
    if (node.type === 'VariableDeclarator' && isNode(node.id) && node.id.type === 'Identifier') {
      bind(node.id.name, node.init)
    } else if (node.type === 'FunctionDeclaration' && isNode(node.id)) {
      bind(node.id.name, node)
    }
    return undefined
  })
  return { rel, program, lineOf: lineIndex(source), bindings }
}

/** Strip the wrappers that do not change an expression's value. */
export function unwrap(node: Node): Node {
  let n = node
  while (
    (n.type === 'ParenthesizedExpression' ||
      n.type === 'TSAsExpression' ||
      n.type === 'TSSatisfiesExpression' ||
      n.type === 'TSNonNullExpression') &&
    isNode(n.expression)
  ) {
    n = n.expression
  }
  return n
}

function jsxName(name: unknown): string {
  if (!isNode(name)) return ''
  if (name.type === 'JSXIdentifier') return String(name.name)
  if (name.type === 'JSXMemberExpression')
    return `${jsxName(name.object)}.${jsxName(name.property)}`
  if (name.type === 'JSXNamespacedName') return `${jsxName(name.namespace)}:${jsxName(name.name)}`
  return ''
}

/** A `JSXElement`'s tag: `TitledBox`, `Dialog.Portal`. */
export function elementName(element: Node): string {
  return isNode(element.openingElement) ? jsxName(element.openingElement.name) : ''
}

/** A `JSXElement`'s named attribute (spreads are not read). */
export function attribute(element: Node, name: string): Node | undefined {
  const opening = element.openingElement
  if (!isNode(opening) || !Array.isArray(opening.attributes)) return undefined
  return (opening.attributes as unknown[]).find(
    (a): a is Node =>
      isNode(a) && a.type === 'JSXAttribute' && isNode(a.name) && a.name.name === name
  )
}

/**
 * The component a node is drawn by, from its ancestors: the outermost
 * PascalCase function or const (`function NpcInset`, `const Peek = …`).
 */
export function componentOf(ancestors: readonly Node[]): string | null {
  for (const a of ancestors) {
    const named = a.type === 'FunctionDeclaration' || a.type === 'VariableDeclarator'
    if (named && isNode(a.id) && /^[A-Z]/.test(String(a.id.name))) return String(a.id.name)
  }
  return null
}

/**
 * An attribute's value as an expression: a string literal stays a literal, a
 * `{…}` container is its expression, and a bare attribute (`onPage`) is
 * `null`, meaning `true`.
 */
export function attributeValue(attr: Node): Node | null {
  const value = attr.value
  if (!isNode(value)) return null
  if (value.type === 'JSXExpressionContainer' && isNode(value.expression)) return value.expression
  return value
}

/**
 * The strings an expression can evaluate to, following conditionals and
 * logical operators to their leaves. `open` is true when some leaf is not a
 * string literal (an identifier, a call), so the list may not be all of them.
 */
export function stringValues(expr: Node | null): { values: string[]; open: boolean } {
  const values: string[] = []
  let open = false
  const visit = (n: Node) => {
    const e = unwrap(n)
    if (e.type === 'Literal' && typeof e.value === 'string') values.push(e.value)
    else if (e.type === 'ConditionalExpression' && isNode(e.consequent) && isNode(e.alternate)) {
      visit(e.consequent)
      visit(e.alternate)
    } else if (e.type === 'LogicalExpression' && isNode(e.left) && isNode(e.right)) {
      visit(e.left)
      visit(e.right)
    } else open = true
  }
  if (expr === null) open = true
  else visit(expr)
  return { values, open }
}
