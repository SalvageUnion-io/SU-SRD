/**
 * The chrome laws read off a component's JSX shape, part of the `chrome` rule
 * set (`rules/chrome.ts`). A line regex cannot tell a Slab directly in a
 * `<section>` from one a `<div>` deep, so these parse each source
 * (`lib/jsxTree`).
 *
 * ## One section, the SlabSection (hard rule R1, ruleset §6.4)
 *
 * A section a Slab heads is a `SlabSection`: the Slab, one gap (8px inside a
 * block, 12px on a Page), its body, the fold and count its props. Before it,
 * some sixty sections were a hand-built `<section>` with a Slab and a body,
 * each with its own gap (4, 6, 8, 12, 16 or the Slab's own 14px) and two
 * kinds of fold.
 *
 * - `slab-section`: a `<Slab` set as a direct JSX child of a `<section`,
 *   anywhere but `SlabSection` (`SLAB_SECTION_HOME`).
 * - `slab-style`: a `style` prop on a `<Slab`: its spacing is its
 *   container's (`SlabSection`'s gap, or `flush` in a spaced column).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { attribute, elementName, parseTsx, walk } from '../lib/jsxTree'
import type { Finding, Rule } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'

const SRC = 'apps/web/src'

const isTest = (rel: string) => rel.includes('/__tests__/') || /\.test\.tsx?$/.test(rel)

/** The one home of a Slab-headed section (ruleset §6.4). */
const SLAB_SECTION_HOME = 'apps/web/src/components/containers/SlabSection.tsx'

export type MarkupFindings = { section: Finding[]; style: Finding[] }

/**
 * Each hand-built Slab section and styled Slab in one `.tsx` source:
 * `section`, a `<Slab` whose parent element is a `<section` (outside
 * `SlabSection`); `style`, a `<Slab` given a `style`.
 */
export function markupFindings(rel: string, source: string): MarkupFindings {
  const out: MarkupFindings = { section: [], style: [] }
  if (!/<Slab\b/.test(source)) return out
  const file = parseTsx(rel, source)
  const lines = source.split('\n')
  walk(file.program, (node, ancestors) => {
    if (node.type !== 'JSXElement' || elementName(node) !== 'Slab') return undefined
    const line = file.lineOf(node.start)
    const text = lines[line - 1]?.trim() ?? ''
    const parent = ancestors.at(-1)
    if (
      rel !== SLAB_SECTION_HOME &&
      parent?.type === 'JSXElement' &&
      elementName(parent) === 'section'
    ) {
      out.section.push({ file: rel, line, detail: `a Slab straight in a <section>: ${text}` })
    }
    const styled = attribute(node, 'style')
    if (styled) {
      out.style.push({
        file: rel,
        line: file.lineOf(styled.start),
        detail: `a styled Slab: ${text}`,
      })
    }
    return undefined
  })
  return out
}

function scanMarkup(root: string, which: keyof MarkupFindings): Finding[] {
  return listFiles(root, [SRC], ['.tsx'])
    .filter((rel) => !isTest(rel))
    .flatMap((rel) => markupFindings(rel, readFileSync(join(root, rel), 'utf8'))[which])
}

/** The rules, spread into the `chrome` rule set. */
export const MARKUP_RULES: (Rule & { scan: (root: string) => Finding[] })[] = [
  {
    id: 'slab-section',
    mode: 'zero',
    rule: 'hard rule R1 (ruleset §6.4) — a section a Slab heads is a `SlabSection`: the Slab, one gap, its body; never a hand-built <section> around a Slab',
    fix: 'Render `<SlabSection title="…" id="…" as="h2">` (from components/index) around the body: `count` for its hint or `SlabCount`, `actions` for its controls, `fold="open" | "closed"` for the one fold, `page` on an SRD Page (12px, R17). The body\'s own layout is `bodyStyle` / `bodyClassName`.',
    scan: (root) => scanMarkup(root, 'section'),
  },
  {
    id: 'slab-style',
    mode: 'zero',
    rule: "hard rule R1 (ruleset §6.4) — a Slab takes no `style`: the gap under it is its container's",
    fix: 'Put the Slab and what it heads in a `SlabSection` (8px under its Slab, 12px with `page`); a Slab in a column that already spaces its children takes `flush`. A wrap or width is a class on `className`.',
    scan: (root) => scanMarkup(root, 'style'),
  },
]
