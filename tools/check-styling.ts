#!/usr/bin/env bun
/**
 * Styling gates — `bun run check styling`.
 *
 * One engine (`tools/lib/ruleEngine.ts`), three rule sets:
 *
 *   - `tokens`   — design-token laws (tools/rules/designTokens.ts)
 *   - `styling`  — component-lib owns shared styling (tools/rules/stylingOwnership.ts)
 *   - `srd-css`  — srd's single stylesheet entry (tools/rules/srdCss.ts)
 *
 * Why these gates exist at all: none of what they catch fails typecheck, lint or
 * a test. A deleted Tailwind token stops generating its utility, a stray app
 * `@theme` compiles, a stylesheet imported from an SSR module silently never
 * ships. Each rule set's header carries its full reasoning.
 *
 * A rule is `zero` (any finding fails) or a `ratchet` counted against
 * `tools/styling-baseline.json`. A ratchet fails when its count RISES, and also
 * when it FALLS without the baseline falling with it — an unrecorded
 * improvement is slack that the next regression spends without anyone seeing.
 *
 * Usage:
 *   bun tools/check-styling.ts                      # all three sets
 *   bun tools/check-styling.ts --only=tokens        # one set (comma-separate for more)
 *   bun tools/check-styling.ts --update-baseline    # lower the ratchets to today's counts
 *   bun tools/check-styling.ts --update-baseline --allow-increase
 *                                                   # ONLY in a commit that makes a rule stricter,
 *                                                   # or that splits files without adding a
 *                                                   # utility (see tools/lib/ruleEngine.ts)
 *   bun tools/check-styling.ts --report             # print every finding; never fails
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Baseline, RuleSet } from './lib/ruleEngine'
import { evaluate, formatFailures, increases, ratchetCounts, readBaseline } from './lib/ruleEngine'
import { designTokens } from './rules/designTokens'
import { srdCss } from './rules/srdCss'
import { stylingOwnership } from './rules/stylingOwnership'

const ROOT = join(import.meta.dir, '..')
const BASELINE_PATH = join(import.meta.dir, 'styling-baseline.json')
const UPDATE = 'bun tools/check-styling.ts --update-baseline'

export const RULE_SETS: readonly RuleSet[] = [designTokens, stylingOwnership, srdCss]

function selectedSets(argv: readonly string[]): RuleSet[] {
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
  const results = new Map(sets.map((set) => [set.id, set.scan(ROOT)] as const))

  if (argv.includes('--report')) {
    for (const set of sets) {
      for (const rule of set.rules) {
        const list = results.get(set.id)?.[rule.id] ?? []
        console.log(`\n── ${set.id}/${rule.id} [${rule.mode}] (${list.length})`)
        for (const f of list) console.log(`   ${f.file}:${f.line}  ${f.detail}`)
      }
      const advisory = set.advisory?.(ROOT)
      if (advisory) {
        console.log(`\n── ${set.id}/${advisory.id} [report-only] (${advisory.findings.length})`)
        for (const f of advisory.findings) console.log(`   ${f.file}:${f.line}  ${f.detail}`)
      }
    }
    return
  }

  const baseline = readBaseline(BASELINE_PATH)

  if (argv.includes('--update-baseline')) {
    const next: Baseline = { ...baseline }
    const raised: string[] = []
    for (const set of sets) {
      const counts = ratchetCounts(set, results.get(set.id) ?? {})
      raised.push(...increases(baseline[set.id] ?? {}, counts).map((r) => `${set.id}/${r}`))
      next[set.id] = counts
    }
    if (raised.length > 0 && !argv.includes('--allow-increase')) {
      console.error('✗ refusing to RAISE a ratchet baseline:')
      for (const r of raised) console.error(`    ${r}`)
      console.error(
        '\n  A baseline only goes down. The two exceptions are the commit that makes a rule\n' +
          '  STRICTER (it counts literals that were always there) and a pure FILE SPLIT (a\n' +
          '  per-file count rises with no literal written) — pass --allow-increase there,\n' +
          '  and write the reason and the evidence into the rule set.'
      )
      process.exit(1)
    }
    const ordered = Object.fromEntries(RULE_SETS.map((s) => [s.id, next[s.id] ?? {}]))
    writeFileSync(BASELINE_PATH, `${JSON.stringify(ordered, null, 2)}\n`)
    console.log(`✓ baseline written: tools/styling-baseline.json`)
    for (const set of sets) {
      for (const [id, n] of Object.entries(ordered[set.id] ?? {}))
        console.log(`   ${set.id}/${id}: ${n}`)
    }
    return
  }

  let failed = false
  for (const set of sets) {
    const verdict = evaluate(set, results.get(set.id) ?? {}, baseline[set.id])
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
    const advisory = set.advisory?.(ROOT)
    if (advisory && advisory.findings.length > 0) {
      console.log(
        `  ⚠ ${advisory.id} [report-only, not enforced]: ${advisory.findings.length} candidate(s) — ` +
          'see --report'
      )
    }
  }
  if (failed) process.exit(1)
}

if (import.meta.main) main(process.argv.slice(2))
