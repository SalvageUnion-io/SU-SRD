/**
 * No `!important` — the `important` rule set of `tools/check-rule-sets.ts`.
 *
 * A mock override layer (`best-site.css`) once shipped 112 `!important`s on
 * every page, each beating an owner's rule or a component's style object
 * instead of changing it, so a fix to the owner did nothing and nobody could
 * tell which spelling won (`.claude/rules/styling.md`: one spelling a
 * property). A value belongs in its owner: the rule it overrides, or the style
 * object, with the state that varies it a class. The web app holds none: not
 * in a stylesheet, and not in a style string or `<style>` text in its code.
 * The cascade has the tools instead: layer order, an id's weight
 * (`:not(#\#)`), `revert-layer`, source order, and for print a paused
 * animation (`styles/build/print.css`). No exemptions.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

const DIRS = ['apps/web/src', 'apps/web/astro']

const stylesheets = (root: string) => listFiles(root, DIRS, ['.css'])

/** The code that could write one into a style: never a test, which may name it. */
const code = (root: string) =>
  listFiles(root, DIRS, ['.ts', '.tsx', '.astro']).filter(
    (f) => !/(^|\/)__tests__\//.test(f) && !/\.test\.tsx?$/.test(f)
  )

const blank = (m: string) => m.replace(/[^\n]/g, ' ')

/** Each `!important` in a stylesheet's declarations, comments blanked so prose that names it is no finding. */
export function importantFindings(file: string, css: string): Finding[] {
  return findings(file, css.replace(/\/\*[\s\S]*?\*\//g, blank))
}

/** Each `!important` in code: a style string, a `<style>`'s text. Comments are blanked
 *  (`//` only after a line start or a space, so a URL in a string stays). */
export function codeImportantFindings(file: string, source: string): Finding[] {
  return findings(
    file,
    source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|\s)\/\/.*$/gm, (m) => blank(m))
  )
}

function findings(file: string, clean: string): Finding[] {
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
    rule: 'ruleset §4.10 — no `!important` in the web app: a value wins in its owner',
    fix: "Put the value in its owner instead: edit the rule it overrides, or the component's style object (a state that varies it is a class, styling.md). To beat a class, use layer order, `:not(#\\#)` weight or `revert-layer`; to beat a style object, change the style object.",
  },
]

export const noImportant: RuleSet = {
  id: 'important',
  label: 'no !important',
  rules: RULES,
  preflight(root) {
    assertScanFloor('!important (stylesheets)', stylesheets(root).length, 15)
    assertScanFloor('!important (code)', code(root).length, 500)
  },
  scan: (root) => ({
    important: [
      ...stylesheets(root).flatMap((file) =>
        importantFindings(file, readFileSync(join(root, file), 'utf8'))
      ),
      ...code(root).flatMap((file) =>
        codeImportantFindings(file, readFileSync(join(root, file), 'utf8'))
      ),
    ],
  }),
  summary: (root) => `${stylesheets(root).length} stylesheets and ${code(root).length} code files`,
}
