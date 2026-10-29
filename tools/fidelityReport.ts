/**
 * What `check-rules-fidelity.ts` prints: the verdict tallies, by verdict and
 * reason, by cited source, and for stat blocks by schema.
 */
import type { ProseItem } from 'gates/lib/proseFidelity'
import { VERDICTS } from 'gates/lib/proseFidelity'
import type { StatResult } from 'gates/lib/statFidelity'

/** One prose verdict, as the summary reads it. */
type SummaryRow = { item: ProseItem; verdict: string; reason?: string }

export const label = (r: { verdict: string; reason?: string }) =>
  r.reason ? `${r.verdict} ${r.reason}` : r.verdict

function countBy<T>(xs: T[], key: (x: T) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function primarySource(item: ProseItem): string {
  const a = item.anchors[0]
  if (!a) return '(no source)'
  return a.booklet ? `${a.source} (${a.booklet})` : a.source
}

export function printSummary(results: SummaryRow[]) {
  console.log('\nVerdicts')
  for (const v of VERDICTS) {
    const rs = results.filter((r) => r.verdict === v)
    if (rs.length === 0) continue
    console.log(`  ${v.padEnd(18)} ${String(rs.length).padStart(5)}`)
    for (const [reason, n] of countBy(rs, (r) => r.reason ?? ''))
      if (reason) console.log(`    ${reason.padEnd(20)} ${String(n).padStart(5)}`)
  }
  console.log('\nBy cited source (verbatim+deviation+authored / unverified / no local text)')
  for (const [src] of countBy(results, (r) => primarySource(r.item))) {
    const rs = results.filter((r) => primarySource(r.item) === src)
    const ok = rs.filter((r) => ['verbatim', 'deviation', 'authored'].includes(r.verdict)).length
    const unv = rs.filter((r) => r.verdict === 'unverified').length
    const nosrc = rs.filter((r) => r.verdict === 'unverified-source').length
    console.log(
      `  ${src.slice(0, 40).padEnd(41)} ${String(rs.length).padStart(5)}  ${ok}/${unv}/${nosrc}`
    )
  }
}

/** Stat verdicts by schema, in the same shape as the prose summary. */
export function printStatSummary(results: StatResult[]) {
  const kind = (r: StatResult) =>
    `${r.item.kind}${r.item.path.startsWith('.actions[') ? ' action' : ''}`
  console.log('\nStat blocks (verbatim / stat-mismatch / no-match / unverified-source)')
  for (const [k] of countBy(results, kind).sort((a, b) => a[0].localeCompare(b[0]))) {
    const rs = results.filter((r) => kind(r) === k)
    const n = (f: (r: StatResult) => boolean) => rs.filter(f).length
    console.log(
      `  ${k.padEnd(18)} ${String(rs.length).padStart(5)}  ${n((r) => r.verdict === 'verbatim')}/${n((r) => r.reason === 'stat-mismatch')}/${n((r) => r.reason === 'no-match')}/${n((r) => r.verdict === 'unverified-source')}`
    )
  }
}

export function excerpt(s: string, n = 90): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
