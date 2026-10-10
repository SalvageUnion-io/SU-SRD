/**
 * Holds the dataset's prose to `packages/salvageunion-reference/fidelity.lock.json`.
 *
 * The package rule is that descriptions and effects are copied verbatim from
 * the books, and nothing enforced it: a 2026-10 audit found prose paraphrased,
 * clauses dropped and text cited to the wrong book, all of it invisible to
 * every gate. The books cannot reach CI — they are gitignored, copyright-
 * bearing PDFs — so the comparison itself runs locally
 * (`check-rules-fidelity.ts`) and records its verdict for every string in the
 * lock, as a hash of the data's text plus a verdict code. No book text.
 *
 * This gate needs no book. It fails when:
 *
 *   - a prose string has no lock entry, or its entry was for different text:
 *     the edit has not been checked against the book. Run
 *     `bun tools/check-rules-fidelity.ts --update` where the extract exists
 *     and commit the lock;
 *   - an entry names a string that no longer exists (`--prune` drops these,
 *     with no book needed: removing a string verifies nothing);
 *   - an entry does not parse — the narrow format is what keeps book text out.
 *
 * It does not fail on an `unverified` verdict. Drift is recorded so it can be
 * scheduled; what the gate refuses is prose nobody has compared.
 *
 * Run:  bun tools/check-fidelity-lock.ts [--prune]
 */

import {
  collectProse,
  compareWithLock,
  LOCK_PATH,
  pruneLock,
  readLockFile,
  VERDICTS,
  writeLockFile,
} from './lib/proseFidelity'
import { assertScanFloor } from './lib/scanFloor'

/** ~65% of the 5,359 strings the dataset held when this gate was written. */
const PROSE_FLOOR = 3500

const FIX = 'bun tools/check-rules-fidelity.ts --update'

function main() {
  const items = collectProse()
  assertScanFloor('rules fidelity (prose strings)', items.length, PROSE_FLOOR)
  const file = readLockFile()
  if (!file) {
    console.error(
      `✗ ${LOCK_PATH} is missing or not JSON. Run \`${FIX}\` where the rules extract exists.`
    )
    process.exit(1)
  }

  if (process.argv.includes('--prune')) {
    const pruned = pruneLock(file, items)
    const dropped = Object.keys(file.entries).length - Object.keys(pruned.entries).length
    writeLockFile(pruned)
    console.log(`Dropped ${dropped} stale entr${dropped === 1 ? 'y' : 'ies'}.`)
    return
  }

  const diff = compareWithLock(items, file)
  const counts = VERDICTS.map((v) => {
    const n = [...diff.entries.values()].filter((e) => e.verdict === v).length
    return `${n} ${v}`
  }).join(', ')
  console.log(`${items.length} prose strings; lock: ${counts}`)

  let failed = false
  if (diff.malformed.length) {
    failed = true
    console.error(
      `\n✗ ${diff.malformed.length} malformed lock entr${diff.malformed.length === 1 ? 'y' : 'ies'}:`
    )
    for (const m of diff.malformed.slice(0, 20)) console.error(`  ${m.key}: ${m.problem}`)
  }
  if (diff.unverified.length) {
    failed = true
    console.error(`\n✗ ${diff.unverified.length} prose string(s) not checked against the book:`)
    for (const { item, was } of diff.unverified.slice(0, 20))
      console.error(
        `  ${item.key} ${was ? '(edited)' : '(new)'}  "${item.text.slice(0, 70)}${item.text.length > 70 ? '…' : ''}"`
      )
    if (diff.unverified.length > 20) console.error(`  … and ${diff.unverified.length - 20} more`)
    console.error(`  Run \`${FIX}\` (needs the local rules extract) and commit the lock.`)
  }
  if (diff.stale.length) {
    failed = true
    console.error(
      `\n✗ ${diff.stale.length} lock entr${diff.stale.length === 1 ? 'y' : 'ies'} for strings that no longer exist:`
    )
    for (const k of diff.stale.slice(0, 20)) console.error(`  ${k}`)
    console.error('  Run `bun tools/check-fidelity-lock.ts --prune` (no book needed).')
  }
  if (failed) process.exit(1)
  console.log('✓ every prose string has a fidelity verdict')
}

main()
