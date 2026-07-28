#!/usr/bin/env tsx
/**
 * Rules-parity audit CLI (ADR-029 §5).
 *
 * Asks one question of every player-content record whose rules text states a
 * mechanical change: is that change ENCODED as structured data, or explicitly
 * EXEMPT with a reason? Anything else is a record whose number the app gets
 * wrong, and the point of this check is that such a record cannot be added
 * silently.
 *
 * Thin CLI wrapper: all detection logic lives in validateParityLogic.ts so this
 * and the unified runner (tools/validate.ts) can never diverge.
 */

import { loadAllDataFiles } from './loadData.js'
import { KNOWN_UNRESOLVED, auditParity, unresolvedFindings } from './validateParityLogic.js'

function main(): void {
  const filesByName = loadAllDataFiles()
  const findings = auditParity(filesByName as never)
  const unresolved = unresolvedFindings(findings)
  const unexpected = unresolved.filter((f) => !KNOWN_UNRESOLVED.includes(f.record))
  const stale = KNOWN_UNRESOLVED.filter((name) => !unresolved.some((f) => f.record === name))

  console.log('='.repeat(80))
  console.log(
    `Rules parity: ${findings.length} claim(s) — ` +
      `${findings.filter((f) => f.encoded).length} encoded, ` +
      `${findings.filter((f) => f.exempt).length} exempt, ` +
      `${unresolved.length} unresolved (${KNOWN_UNRESOLVED.length} known, burning down)`
  )

  if (unexpected.length > 0) {
    console.error('\n✗ NEW unencoded rules claims\n')
    for (const f of unexpected) {
      console.error(`  ${f.schema} :: ${f.record}  [${f.klass}]`)
      console.error(`      "${f.sentence}"`)
    }
    console.error(
      '\nEncode the change on the record (`contributions` / `statBonus` / choice ' +
        '`effects`), or add a reasoned entry to PARITY_EXEMPTIONS.\n' +
        'Never infer a number from prose — if the text does not state a flat ' +
        'value, it is an exemption, not a guess.'
    )
    process.exit(1)
  }

  if (stale.length > 0) {
    console.error('\n✗ STALE entries in KNOWN_UNRESOLVED (now encoded or gone):\n')
    for (const name of stale) console.error(`  ${name}`)
    console.error('\nRemove them — a burn-down list that never shrinks is not burning down.')
    process.exit(1)
  }

  console.log('✅ Every stated mechanical change is encoded or reasoned.')
}

main()
