/**
 * The hierarchy laws a source can show — the `hierarchy` rule set of
 * `tools/check-rule-sets.ts`. What the eye ranks at render is `_hierarchy.ts`'s
 * (hard rule R55); this reads the code.
 *
 * - `font-size-rung` (ruleset §4.8): a font size that is no rung of the type
 *   ladder: a retired token (`fontSize.sm`, `var(--text-xs)`, …) or a literal
 *   `font-size` / `fontSize`.
 * - `bare-applink` (hard rule R54): an `AppLink` whose children are only text,
 *   a link drawn as plain words; a standalone link is `Button href`, a link in
 *   prose `InlineRef`.
 *
 * Both are zero: any finding fails.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { elementName, isNode, parseTsx, walk } from '../lib/jsxTree'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

const SRC = 'apps/web/src'

/** Retired rungs: the inherited rem aliases, the 11.5px note and the 26px display. */
const RETIRED = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', 'note', 'display']

const RETIRED_SCRIPT = new RegExp(
  `fontSize\\.(?:${RETIRED.filter((r) => /^\w+$/.test(r)).join('|')})\\b|fontSize\\[['"]2xl['"]\\]`
)
const RETIRED_VAR = new RegExp(`var\\(--text-(?:${RETIRED.join('|')})\\)`)
const LITERAL_CSS = /font-size:\s*-?[\d.]+(?:px|rem|em)\b/
const OG_SELECTOR = /[-_]og\b|'og'/
const LITERAL_SCRIPT = /fontSize:\s*['"`]?-?[\d.]+(?:px|rem|em)?['"`]?\s*[,}]/

/** The ladder's own home, the browser reset, and the link preview's (chrome K12), which draws at its own sizes. */
const OWNERS = [
  'apps/web/src/styles/theme.css',
  'apps/web/src/styles/reset.css',
  'apps/web/src/design/tokens.ts',
  'apps/web/src/components/compositions/OgCard.tsx',
  'apps/web/src/components/compositions/BrandCard.tsx',
  'apps/web/src/components/shared/LinkPreviewSurface.tsx',
  'apps/web/src/components/islands/OgCardIsland.tsx',
]

const isTest = (rel: string) => rel.split('/').includes('__tests__') || /\.test\.tsx?$/.test(rel)

/** A line's code, a comment-only line blanked. */
function codeOf(line: string): string {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return ''
  return line.replace(/\/\/.*$/, '')
}

export function fontSizeFindings(rel: string, source: string): Finding[] {
  if (OWNERS.some((o) => rel.startsWith(o))) return []
  const out: Finding[] = []
  const css = rel.endsWith('.css')
  // A stylesheet rule for the link preview (`og` in its selector) is the preview's own scale.
  let preview = false
  source.split('\n').forEach((raw, i) => {
    if (css && raw.trimEnd().endsWith('{')) preview = OG_SELECTOR.test(raw)
    if (preview) return
    const line = css ? raw : codeOf(raw)
    const retired =
      line.match(RETIRED_VAR)?.[0] ?? (css ? undefined : line.match(RETIRED_SCRIPT)?.[0])
    const literal = line.match(css ? LITERAL_CSS : LITERAL_SCRIPT)?.[0]
    const hit = retired ?? literal
    if (hit) {
      out.push({
        file: rel,
        line: i + 1,
        detail: `\`${hit.trim()}\`: a size off the type ladder (§4.8)`,
      })
    }
  })
  return out
}

export function bareAppLinkFindings(rel: string, source: string): Finding[] {
  if (!source.includes('<AppLink')) return []
  const tree = parseTsx(rel, source)
  const out: Finding[] = []
  walk(tree.program, (node) => {
    if (node.type !== 'JSXElement' || elementName(node) !== 'AppLink') return undefined
    const children = Array.isArray(node.children) ? node.children.filter(isNode) : []
    const words = children.every(
      (c) =>
        c.type === 'JSXText' ||
        (c.type === 'JSXExpressionContainer' &&
          isNode(c.expression) &&
          c.expression.type !== 'JSXElement' &&
          c.expression.type !== 'JSXFragment' &&
          c.expression.type !== 'LogicalExpression' &&
          c.expression.type !== 'ConditionalExpression')
    )
    if (children.length > 0 && words) {
      out.push({
        file: rel,
        line: tree.lineOf(node.start),
        detail:
          'an AppLink of plain words: a standalone link is `Button href`, one in prose `InlineRef` (R54)',
      })
    }
    return undefined
  })
  return out
}

const RULES: readonly Rule[] = [
  {
    id: 'font-size-rung',
    mode: 'zero',
    rule: 'ruleset §4.8 — every font size is a rung of the type ladder (`--text-*`)',
    fix: 'Use a rung: badge 11, chip 12, caption 13, body 14, lede 16, readout 17, title 22, display 31, hero 38, chapter 64 (`fontSize.*`, `var(--text-*)`). The rem aliases, `note` and the 26px `display` are retired; no literal size.',
  },
  {
    id: 'bare-applink',
    mode: 'zero',
    rule: 'hard rule R54 — a link looks like a link',
    fix: 'Draw a standalone link as `<Button href>`, a link in a sentence as `InlineRef`; an `AppLink` wraps a whole card or row, never bare words.',
  },
]

function sources(root: string): string[] {
  return listFiles(root, [SRC], ['.ts', '.tsx', '.css']).filter((rel) => !isTest(rel))
}

/** About 1,100 files today; a scan that finds far fewer has lost its way. */
const FILE_FLOOR = 600

export const hierarchy: RuleSet = {
  id: 'hierarchy',
  label: 'hierarchy: the type ladder and link look',
  rules: RULES,
  preflight(root) {
    assertScanFloor('hierarchy', sources(root).length, FILE_FLOOR)
  },
  scan(root) {
    const sizes: Finding[] = []
    const links: Finding[] = []
    for (const rel of sources(root)) {
      const source = readFileSync(join(root, rel), 'utf8')
      sizes.push(...fontSizeFindings(rel, source))
      if (rel.endsWith('.tsx')) links.push(...bareAppLinkFindings(rel, source))
    }
    return { 'font-size-rung': sizes, 'bare-applink': links }
  },
  exemptionsLive: 'packages/gates/rules/hierarchy.ts (OWNERS)',
}
