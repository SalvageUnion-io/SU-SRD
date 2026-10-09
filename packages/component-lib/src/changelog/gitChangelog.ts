/**
 * The changelog is `main`'s history, read at build time (ADR-041). Node-only:
 * the apps call it from a build step (srd's SSR pass, ITUN's `vite.config.ts`)
 * and ship only the entries, never this module.
 *
 * A squash title is the entry. Only `feat`, `fix` and `perf` count, and only
 * under the app's own scope: `feat(itun): …` is ITUN's, so an ITUN change never
 * shows on the SRD's page, whatever files it touched. An unscoped title is no
 * app's.
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { ChangelogEntry } from './Changelog'

const REPO = 'https://github.com/SalvageUnion-io/SU-SRD'
const SUBJECT = /^(?:feat|fix|perf)\(([a-z0-9./-]+)\)!?: (.+?)(?: \(#(\d+)\))?$/

/** `log` is `git log --format=%ad%x09%s --date=short` output, newest first. */
export function changelogFromLog(log: string, scope: string, area: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  for (const line of log.split('\n')) {
    const [date, subject] = line.split('\t')
    const match = subject?.match(SUBJECT)
    if (!date || !match || match[1] !== scope) continue
    const pr = match[3]
    const item = pr ? `${match[2]} ([#${pr}](${REPO}/pull/${pr}))` : (match[2] ?? '')
    const last = entries.at(-1)
    if (last?.date === date) last.items.push(item)
    else entries.push({ date, area, items: [item] })
  }
  return entries
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
