/**
 * The `!important` ratchet — the `important` rule set of `tools/check-rule-sets.ts`.
 *
 * A mock override layer (`best-site.css`) once shipped 112 `!important`s on
 * every page, each beating an owner's rule or a component's style object
 * instead of changing it, so a fix to the owner did nothing and nobody could
 * tell which spelling won (`.claude/rules/styling.md`: one spelling a
 * property). A value belongs in its owner: the rule it overrides, or the style
 * object, with the state that varies it a class. A stylesheet holds none
 * unless `HELD` names it, and then no more than its count there: lower the
 * count when one goes, delete the entry at zero, never raise or add one.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

const STYLE_DIRS = ['apps/web/src/styles']

const stylesheets = (root: string) => listFiles(root, STYLE_DIRS, ['.css'])

/** The stylesheets that still hold some, at their count when the rule landed. */
export const HELD: Readonly<Record<string, number>> = {
  // A print sheet must beat every screen rule and style object.
  'apps/web/src/styles/build/print.css': 18,
  'apps/web/src/styles/base.css': 1,
  // The `hidden` attribute wins over any display, as the browser's own does.
  'apps/web/src/styles/reset.css': 1,
  // Reduced motion out-ranks every animation, inline ones included.
  'apps/web/src/styles/theme.css': 4,
  // Reaching past an unlayered library or app rule from the package layer.
  'apps/web/src/styles/partials/atoms-leaves.css': 1,
  'apps/web/src/styles/partials/compositions.css': 1,
  // Rows over the Mini's and Compact's own frames, still to fold into them.
  'apps/web/src/styles/partials/entity-forms.css': 7,
}

/** Each stylesheet over its held count; one under it must lower the count. */
export function overHeld(findings: readonly Finding[]): Finding[] {
  const byFile = new Map<string, Finding[]>()
  for (const f of findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f])
  const out: Finding[] = []
  for (const [file, found] of byFile) {
    const held = HELD[file] ?? 0
    if (found.length > held) out.push(...found.slice(held))
  }
  for (const [file, held] of Object.entries(HELD)) {
    const count = byFile.get(file)?.length ?? 0
    if (count < held)
      out.push({
        file,
        line: 1,
        detail: `holds ${count} !important, under its HELD ${held}: lower it`,
      })
  }
  return out
}

/** Each `!important` in a declaration, comments blanked so prose that names it is no finding. */
export function importantFindings(file: string, css: string): Finding[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const out: Finding[] = []
  clean.split('\n').forEach((text, index) => {
    for (const _ of text.matchAll(/!\s*important\b/gi))
      out.push({ file, line: index + 1, detail: `!important: ${text.trim()}` })
  })
  return out
}

const RULES: Rule[] = [
  {
    id: 'important',
    mode: 'zero',
    rule: 'ruleset §4.10 — no `!important` beats an owner: the count per stylesheet only falls',
    fix: "Put the value in its owner instead: edit the rule it overrides, or the component's style object (a state that varies it is a class, styling.md). Never add one; when a stylesheet's count falls, lower its `HELD` entry in packages/gates/rules/importantRatchet.ts (delete it at zero).",
  },
]

export const importantRatchet: RuleSet = {
  id: 'important',
  label: 'the !important ratchet',
  rules: RULES,
  exemptionsLive: 'packages/gates/rules/importantRatchet.ts',
  preflight(root) {
    assertScanFloor('!important (stylesheets)', stylesheets(root).length, 15)
  },
  scan: (root) => ({
    important: overHeld(
      stylesheets(root).flatMap((file) =>
        importantFindings(file, readFileSync(join(root, file), 'utf8'))
      )
    ),
  }),
}
