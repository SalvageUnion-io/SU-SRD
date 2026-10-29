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
 * The numbers are held the same way: every stat block (`gates/lib/statFidelity.ts`
 * — a chassis' stats, a pattern's parts, a System's Tech Level, an action's
 * stat line) has an entry keyed `…@stat`, hashed over the fields as the book
 * prints them.
 *
 * This gate needs no book. It fails when:
 *
 *   - a prose string or stat block has no lock entry, or its entry was for different text:
 *     the edit has not been checked against the book. Run
 *     `bun tools/check-rules-fidelity.ts --update` where the extract exists
 *     and commit the lock;
 *   - an entry names a string that no longer exists (`--prune` drops these,
 *     with no book needed: removing a string verifies nothing);
 *   - an entry does not parse — the narrow format is what keeps book text out.
 *
 * A recorded drift verdict passes, so it can be scheduled; what the gate
 * refuses is prose nobody has compared, and more of it than before: the
 * `deviation`, `unverified` and `unverified-source` counts ratchet against
 * `tools/baselines/fidelity.json`, so a paraphrase recorded as `deviation`
 * fails rather than landing quietly. A count only falls (`--update-baseline`);
 * a rise needs `--allow-increase` and the reason in the PR. A hand-written
 * `verbatim` line still parses: review holds that, as the lock is generated.
 *
 * Run:  bun tools/check-fidelity-lock.ts [--prune | --update-baseline [--allow-increase]]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LockItem } from 'gates/lib/proseFidelity'
import {
  collectProse,
  compareWithLock,
  LOCK_PATH,
  pruneLock,
  readLockFile,
  VERDICTS,
  writeLockFile,
} from 'gates/lib/proseFidelity'
import { assertScanFloor } from 'gates/lib/scanFloor'
import { collectStats } from 'gates/lib/statFidelity'

const BASELINE_PATH = join(import.meta.dir, 'baselines', 'fidelity.json')
const UPDATE_BASELINE = 'bun tools/check-fidelity-lock.ts --update-baseline'

/** The verdicts that say a string is not the book's words, held from growing. */
const RATCHETED = ['deviation', 'unverified', 'unverified-source'] as const
type Counts = Record<(typeof RATCHETED)[number], number>

/** One line per ratcheted verdict whose count differs from the baseline. */
export function ratchetProblems(baseline: Partial<Counts>, counts: Counts): string[] {
  return RATCHETED.flatMap((v) => {
    const allowed = baseline[v] ?? 0
    if (counts[v] > allowed)
      return [
        `${counts[v]} \`${v}\` verdicts, baseline ${allowed}: compare the new prose with the book, or record the rise with \`${UPDATE_BASELINE} --allow-increase\` and say why in the PR`,
      ]
    if (counts[v] < allowed)
      return [
        `${counts[v]} \`${v}\` verdicts, baseline ${allowed}: lock the gain in with \`${UPDATE_BASELINE}\``,
      ]
    return []
  })
}

/** ~65% of the 5,359 strings the dataset held when this gate was written. */
const PROSE_FLOOR = 3500
/** ~65% of the 939 stat blocks the dataset held when stats joined the lock. */
const STAT_FLOOR = 600

const FIX = 'bun tools/check-rules-fidelity.ts --update'

function readCounts(path: string): Partial<Counts> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Partial<Counts>
  } catch {
    return {}
  }
}

/** Every prose string and stat block in the dataset, each held to its scan floor. */
function collectItems(): { prose: LockItem[]; stats: LockItem[] } {
  const prose = collectProse()
  assertScanFloor('rules fidelity (prose strings)', prose.length, PROSE_FLOOR)
  const stats = collectStats()
  assertScanFloor('rules fidelity (stat blocks)', stats.length, STAT_FLOOR)
  return { prose, stats }
}

/** What `main` reads, writes and prints through; the defaults are the repo's. */
export type MainOptions = {
  collect?: () => { prose: LockItem[]; stats: LockItem[] }
  lockPath?: string
  baselinePath?: string
  log?: (line: string) => void
  error?: (line: string) => void
}

/** Run the gate (or `--prune` / `--update-baseline`); returns the exit code. */
export function main(
  argv: readonly string[] = process.argv.slice(2),
  {
    collect = collectItems,
    lockPath = LOCK_PATH,
    baselinePath = BASELINE_PATH,
    log = console.log,
    error = console.error,
  }: MainOptions = {}
): number {
  const { prose, stats } = collect()
  const items = [...prose, ...stats]
  const file = readLockFile(lockPath)
  if (!file) {
    error(`✗ ${lockPath} is missing or not JSON. Run \`${FIX}\` where the rules extract exists.`)
    return 1
  }

  if (argv.includes('--prune')) {
    const pruned = pruneLock(file, items)
    const dropped = Object.keys(file.entries).length - Object.keys(pruned.entries).length
    writeLockFile(pruned, lockPath)
    log(`Dropped ${dropped} stale entr${dropped === 1 ? 'y' : 'ies'}.`)
    return 0
  }

  const diff = compareWithLock(items, file)
  const countOf = (v: string) => [...diff.entries.values()].filter((e) => e.verdict === v).length
  const counts = VERDICTS.map((v) => `${countOf(v)} ${v}`).join(', ')
  log(`${prose.length} prose strings, ${stats.length} stat blocks; lock: ${counts}`)

  const ratcheted = Object.fromEntries(RATCHETED.map((v) => [v, countOf(v)])) as Counts
  const baseline = readCounts(baselinePath)
  if (argv.includes('--update-baseline')) {
    const raised = RATCHETED.filter((v) => ratcheted[v] > (baseline[v] ?? 0))
    if (raised.length > 0 && !argv.includes('--allow-increase')) {
      error(
        `✗ refusing to RAISE ${raised.join(', ')}: a baseline only falls. Pass --allow-increase only with the reason in the PR.`
      )
      return 1
    }
    writeFileSync(baselinePath, `${JSON.stringify(ratcheted, null, 2)}\n`)
    log('✓ baseline written: tools/baselines/fidelity.json')
    return 0
  }

  const problems: string[] = []
  if (diff.malformed.length) {
    problems.push(
      `\n✗ ${diff.malformed.length} malformed lock entr${diff.malformed.length === 1 ? 'y' : 'ies'}:`,
      ...diff.malformed.slice(0, 20).map((m) => `  ${m.key}: ${m.problem}`)
    )
  }
  if (diff.unverified.length) {
    problems.push(
      `\n✗ ${diff.unverified.length} prose string(s) or stat block(s) not checked against the book:`,
      ...diff.unverified
        .slice(0, 20)
        .map(
          ({ item, was }) =>
            `  ${item.key} ${was ? '(edited)' : '(new)'}  "${item.text.slice(0, 70)}${item.text.length > 70 ? '…' : ''}"`
        )
    )
    if (diff.unverified.length > 20) problems.push(`  … and ${diff.unverified.length - 20} more`)
    problems.push(`  Run \`${FIX}\` (needs the local rules extract) and commit the lock.`)
  }
  if (diff.stale.length) {
    problems.push(
      `\n✗ ${diff.stale.length} lock entr${diff.stale.length === 1 ? 'y' : 'ies'} for strings that no longer exist:`,
      ...diff.stale.slice(0, 20).map((k) => `  ${k}`),
      '  Run `bun tools/check-fidelity-lock.ts --prune` (no book needed).'
    )
  }
  const ratchet = ratchetProblems(baseline, ratcheted)
  if (ratchet.length) {
    problems.push(
      '\n✗ drift verdicts off their baseline (tools/baselines/fidelity.json):',
      ...ratchet.map((line) => `  ${line}`)
    )
  }
  if (problems.length) {
    for (const line of problems) error(line)
    return 1
  }
  log('✓ every prose string and stat block has a fidelity verdict, drift at baseline')
  return 0
}

if (import.meta.main) process.exit(main())
