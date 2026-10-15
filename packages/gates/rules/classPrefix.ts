/**
 * One class prefix — the `class-prefix` rule set of `tools/check-styling.ts`.
 *
 * Every class the package and the Cantina author is `su-*` (the Dashboard's
 * `su-dash-*` among them; `.claude/rules/styling.md`). The Cantina once grew `wiz-`,
 * `header-menu-`, `npc-`, `shelves-` and a dozen more families beside some 800
 * `su-` selectors, and component-lib's tone contexts were `sheet--{kind}`: two
 * naming schemes for one stylesheet system, with nothing to say which a new
 * class should take. A wrong prefix compiles and renders, so only a scan
 * catches it.
 *
 * srd's own stylesheets keep their `srd-*` names and are outside this set.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

const PREFIXED_CSS_DIRS = ['apps/web/src/cantina', 'packages/component-lib/src'] as const
const CLASS_PREFIX = 'su-'

const stylesheets = (root: string) => listFiles(root, PREFIXED_CSS_DIRS, ['.css'])

/**
 * Every class named in a selector, nested and inside at-rule blocks too, with
 * its line. Comments and quoted strings are blanked first, newlines kept, so
 * neither prose nor an `@import` path reads as a selector.
 */
function selectorClasses(css: string): { name: string; line: number }[] {
  const clean = css
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/'[^'\n]*'|"[^"\n]*"/g, "''")
  const out: { name: string; line: number }[] = []
  for (const m of clean.matchAll(/[^{};]+(?=\{)/g)) {
    const selector = m[0]
    if (selector.trim().startsWith('@')) continue
    const start = clean.slice(0, m.index).split('\n').length
    for (const cls of selector.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) {
      const name = cls[1]
      if (name === undefined) continue
      out.push({ name, line: start + (selector.slice(0, cls.index).match(/\n/g)?.length ?? 0) })
    }
  }
  return out
}

function scanClassPrefix(root: string): Finding[] {
  const out: Finding[] = []
  for (const file of stylesheets(root)) {
    const seen = new Set<string>()
    for (const { name, line } of selectorClasses(readFileSync(join(root, file), 'utf8'))) {
      if (name.startsWith(CLASS_PREFIX) || seen.has(name)) continue
      seen.add(name)
      out.push({ file, line, detail: `.${name} is not a .${CLASS_PREFIX}* class` })
    }
  }
  return out
}

const RULES: Rule[] = [
  {
    id: 'class-prefix',
    mode: 'zero',
    rule: '.claude/rules/styling.md — every package and the Cantina class is `su-*`',
    fix: 'Rename the class to `su-<name>`, keeping its family word (`su-wiz-*`, `su-sheet-*`; the Dashboard is `su-dash-*`), in the stylesheet and in every className, test and comment that names it.',
  },
]

export const classPrefix: RuleSet = {
  id: 'class-prefix',
  label: 'class prefix',
  rules: RULES,
  exemptionsLive: 'packages/gates/rules/classPrefix.ts',
  preflight(root) {
    // Today some 50 stylesheets across the two trees; far below, per scanFloor.ts.
    assertScanFloor('class prefix (stylesheets)', stylesheets(root).length, 15)
  },
  scan: (root) => ({ 'class-prefix': scanClassPrefix(root) }),
}
