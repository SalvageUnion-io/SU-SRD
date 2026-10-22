#!/usr/bin/env bun
/**
 * check-canon — every law in the design canon names the gate that holds it
 * (`bun run check canon`).
 *
 * The registry is `CANON` (`packages/gates/lib/canon.ts`): each id the canon
 * docs define (ruleset Source and §, K, E, N, C, R) maps to the rule-set
 * rules, checks, tests and e2e scanners that fail when it breaks. This fails
 * on a law with no entry, an entry for no law, and a gate that does not exist,
 * so a law lands with its gate or not at all, and a gate cannot be deleted
 * while a law still names it.
 *
 * Usage:
 *   bun tools/check-canon.ts           # check
 *   bun tools/check-canon.ts --list    # each law and the gates that hold it
 */

import { join } from 'node:path'
import type { CanonContext } from 'gates/lib/canon'
import { CANON, canonFaults, canonLaws, gatesOf } from 'gates/lib/canon'
import { assertScanFloor } from 'gates/lib/scanFloor'
import { CHECKS } from './check'
import { RULE_SETS } from './check-rule-sets'

const ROOT = join(import.meta.dir, '..')

/** About 80% of today's 179 laws: a canon that parses to fewer lost its numbering. */
const LAW_FLOOR = 140

export const CONTEXT: CanonContext = {
  rules: new Set(RULE_SETS.flatMap((set) => set.rules.map((rule) => `${set.id}/${rule.id}`))),
  checks: new Set(CHECKS.map((check) => check.id)),
}

/** Run the check, or `--list` the registry. Exit code. */
export function main(root = ROOT, argv: readonly string[] = [], context = CONTEXT): number {
  const laws = canonLaws(root)
  if (argv.includes('--list')) {
    for (const id of laws.keys()) console.log(`${id.padEnd(9)} ${gatesOf(id).join(', ')}`)
    return 0
  }
  assertScanFloor('canon (laws in docs/design-system)', laws.size, LAW_FLOOR)
  const faults = canonFaults(root, context, CANON)
  if (faults.length === 0) {
    console.log(`✓ canon: ${laws.size} laws, each held by a gate`)
    return 0
  }
  for (const fault of faults) console.error(`✗ ${fault}`)
  console.error(
    `\n${faults.length} canon fault(s): name the law's gate in CANON (packages/gates/lib/canon.ts), or cut the law`
  )
  return 1
}

if (import.meta.main) process.exit(main(ROOT, process.argv.slice(2)))
