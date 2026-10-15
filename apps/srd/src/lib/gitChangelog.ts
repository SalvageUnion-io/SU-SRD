/**
 * The changelog is `main`'s history, read at build time (ADR-041). Node-only:
 * srd's SSR pass calls it for `/changelog`, the changelog both tools share, and
 * ships only the entries, never this module.
 *
 * A squash title is the entry. Only `feat`, `fix` and `perf` count, and only
 * under an app's own scope: `feat(cantina): …` is the Cantina's, so it lands in the App's
 * entries, never the Site's, whatever files it touched. A title may name several
 * (`feat(cantina,srd): …`, a release of both); an unscoped title is no app's.
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { ChangelogEntry } from '../components/Changelog'

const REPO = 'https://github.com/SalvageUnion-io/SU-SRD'
/** Scopes a title used before its app was renamed: The Cantina's titles were `itun`. */
const FORMER_SCOPES: Readonly<Record<string, readonly string[]>> = { cantina: ['itun'] }
const SUBJECT = /^(?:feat|fix|perf)\(([a-z0-9./-]+(?:,[a-z0-9./-]+)*)\)!?: (.+?)(?: \(#(\d+)\))?$/

/**
 * `log` is `git log --format=%ad%x09%s --date=short` output, newest first.
 *
 * `%ad` is the author date, which a squash keeps from the branch, so history
 * order is not date order: a day can come back after an older one. Each day is
 * one entry wherever its commits fall, and the entries run newest day first.
 */
export function changelogFromLog(log: string, scope: string, area: string): ChangelogEntry[] {
  const byDate = new Map<string, ChangelogEntry>()
  const scopes = [scope, ...(FORMER_SCOPES[scope] ?? [])]
  for (const line of log.split('\n')) {
    const [date, subject] = line.split('\t')
    const match = subject?.match(SUBJECT)
    if (!date || !match?.[1]?.split(',').some((s) => scopes.includes(s))) continue
    const pr = match[3]
    const item = pr ? `${match[2]} ([#${pr}](${REPO}/pull/${pr}))` : (match[2] ?? '')
    const day = byDate.get(date)
    if (day) day.items.push(item)
    else byDate.set(date, { date, area, items: [item] })
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/** One entry per day on `main`'s first-parent history, newest first. */
export function readChangelog(scope: string, area: string): ChangelogEntry[] {
  const log = execFileSync(
    'git',
    ['log', '--first-parent', '--date=short', '--format=%ad%x09%s', 'HEAD'],
    // The repo this file is in, whatever the build's cwd.
    { cwd: fileURLToPath(new URL('.', import.meta.url)), encoding: 'utf8', maxBuffer: 64 << 20 }
  )
  return changelogFromLog(log, scope, area)
}
