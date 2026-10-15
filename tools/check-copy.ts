#!/usr/bin/env bun
/**
 * Copy lint for game terms — `bun run check copy`.
 *
 * The book capitalises its game nouns ("Mech" 968 times to "mech" 15 in the
 * Core Book); the Cantina's copy wrote them lower case about half the time, said
 * "TL" and "Heat Cap" where the book never does, and spelled the product three
 * ways. Nothing failed for any of it. This gate reads every JSX text node and
 * prose string literal a user-facing surface ships and flags a lower-case game
 * term (the list is `data/keywords.json`, weighed by the dataset's own prose)
 * or a banned spelling. The rule set, its corpus and its reasoning live in
 * `packages/gates/rules/copyTerms.ts`.
 *
 * Both rules are ratchets against `tools/baselines/copy-baseline.json`, on the
 * styling gates' engine (`packages/gates/lib/ruleEngine.ts`): a count may not
 * rise, and a fall must be locked in.
 *
 * Usage:
 *   bun tools/check-copy.ts                      # the gate
 *   bun tools/check-copy.ts --report             # print every finding; never fails
 *   bun tools/check-copy.ts --update-baseline    # lower the ratchets to today's counts
 *   bun tools/check-copy.ts --update-baseline --allow-increase
 *                                                # ONLY in a commit that makes a rule stricter
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  evaluate,
  formatFailures,
  increases,
  ratchetCounts,
  readBaseline,
} from 'gates/lib/ruleEngine'
import { copyTerms } from 'gates/rules/copyTerms'

const ROOT = join(import.meta.dir, '..')
const BASELINE_PATH = join(import.meta.dir, 'baselines', 'copy-baseline.json')
const UPDATE = 'bun tools/check-copy.ts --update-baseline'

function main(argv: readonly string[]): void {
  const set = copyTerms
  set.preflight?.(ROOT)
  const results = set.scan(ROOT)

  if (argv.includes('--report')) {
    for (const rule of set.rules) {
      const list = results[rule.id] ?? []
      console.log(`\n── ${set.id}/${rule.id} [${rule.mode}] (${list.length})`)
      for (const f of list) console.log(`   ${f.file}:${f.line}  ${f.detail}`)
    }
    return
  }

  const baseline = readBaseline(BASELINE_PATH)

  if (argv.includes('--update-baseline')) {
    const counts = ratchetCounts(set, results)
    const raised = increases(baseline[set.id] ?? {}, counts)
    if (raised.length > 0 && !argv.includes('--allow-increase')) {
      console.error('✗ refusing to RAISE a ratchet baseline:')
      for (const r of raised) console.error(`    ${set.id}/${r}`)
      console.error(
        '\n  A baseline only goes down. The one exception is the commit that makes a rule\n' +
          '  STRICTER (it counts copy that was always there): pass --allow-increase there,\n' +
          '  and write the reason into packages/gates/rules/copyTerms.ts.'
      )
      process.exit(1)
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify({ [set.id]: counts }, null, 2)}\n`)
    console.log('✓ baseline written: tools/baselines/copy-baseline.json')
    for (const [id, n] of Object.entries(counts)) console.log(`   ${set.id}/${id}: ${n}`)
    return
  }

  const verdict = evaluate(set, results, baseline[set.id])
  if (!verdict.ok) {
    console.error(`\n✗ ${set.label}\n`)
    for (const line of formatFailures(verdict, UPDATE)) console.error(line)
    process.exit(1)
  }
  const known = verdict.rules.reduce((n, r) => n + r.found, 0)
  console.log(
    `✓ ${set.label}: ${known} ratcheted finding(s) at baseline, ${set.summary?.(ROOT) ?? ''}`
  )
}

if (import.meta.main) main(process.argv.slice(2))
