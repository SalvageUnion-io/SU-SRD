#!/usr/bin/env bun
/**
 * Rule-set gates — `bun run check styling` and `bun run check copy`.
 *
 * One engine (`packages/gates/lib/ruleEngine.ts`), one runner, twelve rule sets:
 *
 *   - `tokens`       — design-token laws (packages/gates/rules/designTokens.ts)
 *   - `chrome-tokens` — rails, dashes, motion, breakpoints (packages/gates/rules/chromeTokens.ts)
 *   - `styling`      — src/components owns shared styling (packages/gates/rules/stylingOwnership.ts)
 *   - `srd-css`      — the site's single stylesheet entry (packages/gates/rules/srdCss.ts)
 *   - `tone-ground`  — no tech-level blue as a header ground (packages/gates/rules/toneGround.ts)
 *   - `class-prefix` — every package and app class is `su-*` (packages/gates/rules/classPrefix.ts)
 *   - `important`    — no `!important` anywhere in the web app, stylesheets or code (packages/gates/rules/noImportant.ts)
 *   - `entity-nesting` — entities nest three levels deep, no titled box inside one (packages/gates/rules/entityNesting.ts)
 *   - `chrome`       — hard-rules' chrome laws: one ground signal, one focus ring, three dialog widths, one job per notice (packages/gates/rules/chrome.ts)
 *   - `select-mode`  — hard rule R15: one select dim, no level-2 seal (packages/gates/rules/selectMode.ts)
 *   - `controls`     — icons take their Size; tabs, segments and toggles by job (packages/gates/rules/controls.ts)
 *   - `copy`         — game terms capitalised as the book does (packages/gates/rules/copyTerms.ts)
 *   - `ui-strings`   — the interface's words live in the message catalogue (packages/gates/rules/uiStrings.ts)
 *
 * Each set belongs to one of two `bun run check` ids, registered in
 * tools/check.ts: `copy` runs the copy sets, `copy` and `ui-strings` (`--group=copy`), `styling` every
 * other set (`--group=styling`). A new set is in a group the moment it is in
 * `RULE_SETS`, so no check can leave it out.
 *
 * Why these gates exist at all: none of what they catch fails typecheck, lint or
 * a test. A deleted token leaves its `var()` resolving to nothing, a stray app
 * `@theme` compiles, a stylesheet imported from an SSR module silently never
 * ships, a lower-case "mech" reads fine to the compiler. Each rule set's header
 * carries its full reasoning.
 *
 * Every rule is `zero`: any finding fails. No count is recorded anywhere, so
 * there is no baseline to keep (the copy sets were ratchets until every finding
 * was fixed).
 *
 * Usage:
 *   bun tools/check-rule-sets.ts                      # every set
 *   bun tools/check-rule-sets.ts --only=tokens,copy   # these sets
 *   bun tools/check-rule-sets.ts --group=styling      # every set the `styling` check runs
 *   bun tools/check-rule-sets.ts --report             # print every finding; never fails
 */

import { join } from 'node:path'
import type { RuleSet } from 'gates/lib/ruleEngine'
import { evaluate, formatFailures } from 'gates/lib/ruleEngine'
import { copyTerms } from 'gates/rules/copyTerms'
import { RULE_SETS } from 'gates/rules/ruleSets'
import { uiStrings } from 'gates/rules/uiStrings'

const ROOT = join(import.meta.dir, '..')

/** The `bun run check` id that runs a set: `copy` for the copy sets, `styling` for the rest. */
const GROUPS = ['styling', 'copy'] as const
type Group = (typeof GROUPS)[number]
const COPY_SETS: ReadonlySet<RuleSet> = new Set([copyTerms, uiStrings])
const groupOf = (set: RuleSet): Group => (COPY_SETS.has(set) ? 'copy' : 'styling')

function selectedSets(argv: readonly string[]): RuleSet[] {
  const group = argv.find((a) => a.startsWith('--group='))?.slice('--group='.length)
  if (group !== undefined) {
    if (!(GROUPS as readonly string[]).includes(group)) {
      console.error(`✗ unknown group: ${group}. Known: ${GROUPS.join(', ')}`)
      process.exit(2)
    }
    return RULE_SETS.filter((s) => groupOf(s) === group)
  }
  const only = argv.find((a) => a.startsWith('--only='))?.slice('--only='.length)
  if (!only) return [...RULE_SETS]
  const ids = only.split(',').filter(Boolean)
  const unknown = ids.filter((id) => !RULE_SETS.some((s) => s.id === id))
  if (unknown.length > 0) {
    console.error(
      `✗ unknown rule set(s): ${unknown.join(', ')}. Known: ${RULE_SETS.map((s) => s.id).join(', ')}`
    )
    process.exit(2)
  }
  return RULE_SETS.filter((s) => ids.includes(s.id))
}

function main(argv: readonly string[]): void {
  const sets = selectedSets(argv)
  for (const set of sets) set.preflight?.(ROOT)
  const results = new Map(sets.map((set) => [set, set.scan(ROOT)] as const))

  if (argv.includes('--report')) {
    for (const set of sets) {
      for (const rule of set.rules) {
        const list = results.get(set)?.[rule.id] ?? []
        console.log(`\n── ${set.id}/${rule.id} [${rule.mode}] (${list.length})`)
        for (const f of list) console.log(`   ${f.file}:${f.line}  ${f.detail}`)
      }
    }
    return
  }

  let failed = false
  for (const set of sets) {
    const verdict = evaluate(set, results.get(set) ?? {})
    if (verdict.ok) {
      const extra = set.summary ? `, ${set.summary(ROOT)}` : ''
      console.log(`✓ ${set.label}: ${verdict.rules.length} rule(s) clean${extra}`)
    } else {
      failed = true
      console.error(`\n✗ ${set.label}\n`)
      for (const line of formatFailures(verdict)) console.error(line)
    }
  }
  if (failed) process.exit(1)
}

if (import.meta.main) main(process.argv.slice(2))
