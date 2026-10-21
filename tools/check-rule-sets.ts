#!/usr/bin/env bun
/**
 * Rule-set gates — `bun run check styling` and `bun run check copy`.
 *
 * One engine (`packages/gates/lib/ruleEngine.ts`), one runner, eleven rule sets:
 *
 *   - `tokens`       — design-token laws (packages/gates/rules/designTokens.ts)
 *   - `chrome-tokens` — rails, dashes, motion, breakpoints (packages/gates/rules/chromeTokens.ts)
 *   - `styling`      — src/components owns shared styling (packages/gates/rules/stylingOwnership.ts)
 *   - `srd-css`      — the site's single stylesheet entry (packages/gates/rules/srdCss.ts)
 *   - `tone-ground`  — no tech-level blue as a header ground (packages/gates/rules/toneGround.ts)
 *   - `class-prefix` — every package and app class is `su-*` (packages/gates/rules/classPrefix.ts)
 *   - `entity-nesting` — entities nest three levels deep, no titled box inside one (packages/gates/rules/entityNesting.ts)
 *   - `chrome`       — chrome.md's laws: one ground signal, one focus ring, three dialog widths, one job per notice (packages/gates/rules/chrome.ts)
 *   - `select-mode`  — hard rule R15: one select dim, no level-2 seal (packages/gates/rules/selectMode.ts)
 *   - `controls`     — icons take their Size; tabs, segments and toggles by job (packages/gates/rules/controls.ts)
 *   - `copy`         — game terms capitalised as the book does (packages/gates/rules/copyTerms.ts)
 *
 * Each set belongs to one of two `bun run check` ids, registered in
 * tools/check.ts: `copy` runs the copy sets (`--group=copy`), `styling` every
 * other set (`--group=styling`). A new set is in a group the moment it is in
 * `RULE_SETS`, so no check can leave it out.
 *
 * Why these gates exist at all: none of what they catch fails typecheck, lint or
 * a test. A deleted token leaves its `var()` resolving to nothing, a stray app
 * `@theme` compiles, a stylesheet imported from an SSR module silently never
 * ships, a lower-case "mech" reads fine to the compiler. Each rule set's header
 * carries its full reasoning.
 *
 * A rule is `zero` (any finding fails) or a `ratchet` counted against
 * `tools/baselines/rule-sets.json`. Today the two `copy` rules ratchet.
 * A ratchet fails when its count RISES, and also when it FALLS without the
 * baseline falling with it — an unrecorded improvement is slack that the next
 * regression spends without anyone seeing. A baseline only falls:
 * `--update-baseline` refuses a rise unless `--allow-increase`, which belongs
 * ONLY in the commit that makes a rule stricter (it counts what was always
 * there), with the reason written into the rule set.
 *
 * Usage:
 *   bun tools/check-rule-sets.ts                      # every set
 *   bun tools/check-rule-sets.ts --only=tokens,copy   # these sets
 *   bun tools/check-rule-sets.ts --group=styling      # every set the `styling` check runs
 *   bun tools/check-rule-sets.ts --update-baseline    # lower the ratchets to today's counts
 *   bun tools/check-rule-sets.ts --update-baseline --allow-increase
 *   bun tools/check-rule-sets.ts --report             # print every finding; never fails
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Baseline, RuleSet } from 'gates/lib/ruleEngine'
import {
  evaluate,
  formatFailures,
  increases,
  ratchetCounts,
  readBaseline,
} from 'gates/lib/ruleEngine'
import { chromeLaws } from 'gates/rules/chrome'
import { chromeTokens } from 'gates/rules/chromeTokens'
import { classPrefix } from 'gates/rules/classPrefix'
import { controlLaws } from 'gates/rules/controls'
import { copyTerms } from 'gates/rules/copyTerms'
import { designTokens } from 'gates/rules/designTokens'
import { entityNesting } from 'gates/rules/entityNesting'
import { selectMode } from 'gates/rules/selectMode'
import { srdCss } from 'gates/rules/srdCss'
import { stylingOwnership } from 'gates/rules/stylingOwnership'
import { toneGround } from 'gates/rules/toneGround'

const ROOT = join(import.meta.dir, '..')
const BASELINE_PATH = join(import.meta.dir, 'baselines', 'rule-sets.json')
const UPDATE = 'bun tools/check-rule-sets.ts --update-baseline'

const RULE_SETS: readonly RuleSet[] = [
  designTokens,
  chromeTokens,
  stylingOwnership,
  srdCss,
  toneGround,
  classPrefix,
  entityNesting,
  chromeLaws,
  selectMode,
  controlLaws,
  copyTerms,
]

/** The `bun run check` id that runs a set: `copy` for the copy sets, `styling` for the rest. */
const GROUPS = ['styling', 'copy'] as const
type Group = (typeof GROUPS)[number]
const COPY_SETS: ReadonlySet<RuleSet> = new Set([copyTerms])
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

  const baseline = readBaseline(BASELINE_PATH)

  if (argv.includes('--update-baseline')) {
    const next: Baseline = { ...baseline }
    const raised: string[] = []
    for (const set of sets) {
      const counts = ratchetCounts(set, results.get(set) ?? {})
      raised.push(...increases(baseline[set.id] ?? {}, counts).map((r) => `${set.id}/${r}`))
      next[set.id] = counts
    }
    if (raised.length > 0 && !argv.includes('--allow-increase')) {
      console.error('✗ refusing to RAISE a ratchet baseline:')
      for (const r of raised) console.error(`    ${r}`)
      console.error(
        '\n  A baseline only goes down. Fix the new findings, or exempt a genuinely-correct\n' +
          '  case in the rule set with a written reason. The one exception is the commit\n' +
          '  that makes a rule STRICTER: pass --allow-increase there, and write the reason\n' +
          '  into the rule set.'
      )
      process.exit(1)
    }
    // Only the sets with a ratchet: a zero rule has no count to record.
    const ordered = Object.fromEntries(
      RULE_SETS.filter((s) => s.rules.some((r) => r.mode === 'ratchet')).map((s) => [
        s.id,
        next[s.id] ?? {},
      ])
    )
    writeFileSync(BASELINE_PATH, `${JSON.stringify(ordered, null, 2)}\n`)
    console.log('✓ baseline written: tools/baselines/rule-sets.json')
    for (const set of sets) {
      for (const [id, n] of Object.entries(ordered[set.id] ?? {}))
        console.log(`   ${set.id}/${id}: ${n}`)
    }
    return
  }

  let failed = false
  for (const set of sets) {
    const verdict = evaluate(set, results.get(set) ?? {}, baseline[set.id])
    const zero = verdict.rules.filter((r) => r.rule.mode === 'zero').length
    const known = verdict.rules.reduce((n, r) => n + (r.rule.mode === 'ratchet' ? r.found : 0), 0)
    if (verdict.ok) {
      const extra = set.summary ? `, ${set.summary(ROOT)}` : ''
      console.log(
        `✓ ${set.label}: ${zero} zero rule(s) clean, ${known} ratcheted finding(s) at baseline${extra}`
      )
    } else {
      failed = true
      console.error(`\n✗ ${set.label}\n`)
      for (const line of formatFailures(verdict, UPDATE)) console.error(line)
    }
  }
  if (failed) process.exit(1)
}

if (import.meta.main) main(process.argv.slice(2))
