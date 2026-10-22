/**
 * A hand-built stepper, for the copy set's `glyph` rule (hard rule R12,
 * ruleset §6.2, §6.3): a `Button` or `button` whose whole text is a sign.
 * A count steps through `Stat` in edit mode, a vital through `VitalGauge`'s
 * `steppers`; both draw `StepButton`, which this does not read.
 */

import { elementName, isNode, parseTsx, walk } from '../lib/jsxTree'
import type { Finding } from '../lib/ruleEngine'

const LONE_SIGN = /^(?:−|-|–|\+|＋|&minus;|&#8722;|&#x2212;|&plus;)$/i
const SIGN_HOSTS = new Set(['Button', 'button'])

/** Every Button whose children are all text (or strings) reading one sign. Pure: the caller reads the file. */
export function loneSignFindings(file: string, source: string): Finding[] {
  const tree = parseTsx(file, source)
  const out: Finding[] = []
  walk(tree.program, (node) => {
    if (node.type !== 'JSXElement' || !SIGN_HOSTS.has(elementName(node))) return undefined
    if (!Array.isArray(node.children)) return undefined
    const parts = node.children.map((c: unknown) => {
      if (!isNode(c)) return undefined
      if (c.type === 'JSXText') return source.slice(c.start, c.end)
      const e = c.type === 'JSXExpressionContainer' ? c.expression : undefined
      return isNode(e) && typeof e.value === 'string' ? e.value : undefined
    })
    const text = parts.includes(undefined) ? '' : parts.join('').trim()
    if (!LONE_SIGN.test(text)) return undefined
    out.push({
      file,
      line: tree.lineOf(node.start),
      detail: `"${text}" as a Button's text: a count steps through Stat in edit mode, a vital through VitalGauge's steppers (R12)`,
    })
    return undefined
  })
  return out
}
