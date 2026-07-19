#!/usr/bin/env bun

/**
 * Coverage aggregation + ratchet.
 *
 * Each workspace's `test:coverage` script runs `bun test --coverage` with the
 * `lcov` reporter (see each package.json), writing `<workspace>/coverage/lcov.info`.
 * This script:
 *
 *   1. Parses every workspace's lcov.info and computes line coverage %.
 *   2. Writes a combined markdown summary (console + $GITHUB_STEP_SUMMARY when
 *      running in CI) and copies the per-workspace lcov files into
 *      `coverage-report/` so CI can upload one artifact for the whole repo.
 *   3. Ratchets: fails if any workspace's coverage % drops below its
 *      `coverage-baseline.json` entry by more than TOLERANCE_PP. Coverage is
 *      allowed to increase freely — bump the baseline file to lock in a gain.
 *
 * A previous coverage CI job (see commit f520ffd1) was removed for re-running
 * the whole suite a second time while gating nothing. This script is what
 * makes a second coverage-instrumented run worth the CI minutes: without an
 * enforced floor, coverage is just an unread number in a log.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  appendFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Percentage points of slack allowed below the recorded baseline before the
// ratchet fails. Baselines are already committed with a couple of points of
// headroom below the coverage observed at authoring time (CI runners and
// future test additions/removals cause small, legitimate wobble); this
// tolerance absorbs floating-point/line-count noise on top of that.
const TOLERANCE_PP = 0.5

type WorkspaceCoverage = {
  workspace: string
  lcovPath: string
  linesFound: number
  linesHit: number
  pct: number
}

const WORKSPACES = [
  'packages/salvageunion-reference',
  'packages/component-lib',
  'apps/srd',
  'apps/itun',
  'apps/discord-bot',
]

function parseLcov(path: string): { linesFound: number; linesHit: number } {
  const contents = readFileSync(path, 'utf-8')
  let linesFound = 0
  let linesHit = 0
  for (const line of contents.split('\n')) {
    if (line.startsWith('LF:')) linesFound += Number(line.slice(3))
    if (line.startsWith('LH:')) linesHit += Number(line.slice(3))
  }
  return { linesFound, linesHit }
}

const results: WorkspaceCoverage[] = []
const missing: string[] = []

for (const workspace of WORKSPACES) {
  const lcovPath = join(root, workspace, 'coverage', 'lcov.info')
  if (!existsSync(lcovPath)) {
    missing.push(workspace)
    continue
  }
  const { linesFound, linesHit } = parseLcov(lcovPath)
  const pct = linesFound > 0 ? (linesHit / linesFound) * 100 : 0
  results.push({ workspace, lcovPath, linesFound, linesHit, pct })
}

type Baseline = Record<string, number>

const baselinePath = join(root, 'coverage-baseline.json')
const baseline: Baseline = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, 'utf-8'))
  : {}

type Row = {
  workspace: string
  pct: number | undefined // undefined = coverage output missing entirely
  baselinePct: number | undefined
  status: 'regressed' | 'improved' | 'stable' | 'unbaselined' | 'missing'
}

const rows: Row[] = []
for (const { workspace, pct } of results) {
  const baselinePct = baseline[workspace]
  if (baselinePct === undefined) rows.push({ workspace, pct, baselinePct, status: 'unbaselined' })
  else if (pct < baselinePct - TOLERANCE_PP)
    rows.push({ workspace, pct, baselinePct, status: 'regressed' })
  else if (pct > baselinePct + TOLERANCE_PP)
    rows.push({ workspace, pct, baselinePct, status: 'improved' })
  else rows.push({ workspace, pct, baselinePct, status: 'stable' })
}
// A baselined workspace with no lcov output at all is a coverage decrease to
// "unmeasurable" — that must fail the ratchet, not silently pass, or dropping
// a workspace's test:coverage output entirely would be a free way around it.
for (const workspace of missing) {
  const baselinePct = baseline[workspace]
  if (baselinePct !== undefined) {
    rows.push({ workspace, pct: undefined, baselinePct, status: 'missing' })
  }
}

const regressions = rows.filter((r) => r.status === 'regressed' || r.status === 'missing')

// --- Report -----------------------------------------------------------------

const reportDir = join(root, 'coverage-report')
mkdirSync(reportDir, { recursive: true })

const lines: string[] = []
lines.push('## Test coverage')
lines.push('')
lines.push('| Workspace | Coverage | Baseline | Status |')
lines.push('| --- | --- | --- | --- |')
for (const row of rows) {
  const baselineCell = row.baselinePct === undefined ? '—' : `${row.baselinePct.toFixed(2)}%`
  const pctCell = row.pct === undefined ? '(missing)' : `${row.pct.toFixed(2)}%`
  const statusCell = {
    regressed: 'FAIL regressed',
    missing: 'FAIL missing',
    improved: 'OK improved',
    stable: 'OK stable',
    unbaselined: 'NEW no baseline',
  }[row.status]
  lines.push(`| ${row.workspace} | ${pctCell} | ${baselineCell} | ${statusCell} |`)
}
if (missing.length > 0 && missing.some((w) => baseline[w] === undefined)) {
  lines.push('')
  lines.push(
    `Missing coverage output (no baseline recorded, informational only): ${missing.filter((w) => baseline[w] === undefined).join(', ')}`
  )
}
if (regressions.length > 0) {
  lines.push('')
  lines.push('**Coverage ratchet failed** — the following workspaces dropped below their baseline:')
  for (const r of regressions) {
    if (r.status === 'missing') {
      lines.push(
        // biome-ignore lint/style/noNonNullAssertion: 'missing' rows are only pushed when baselinePct !== undefined (see rows construction above)
        `- \`${r.workspace}\`: no coverage output was produced (baseline ${r.baselinePct!.toFixed(2)}%). A workspace with a recorded baseline must keep producing \`coverage/lcov.info\`.`
      )
    } else {
      lines.push(
        // biome-ignore lint/style/noNonNullAssertion: 'regressed' rows come from the results loop where pct is a number and baselinePct passed the undefined check
        `- \`${r.workspace}\`: ${r.pct!.toFixed(2)}% is below baseline ${r.baselinePct!.toFixed(2)}% (tolerance ${TOLERANCE_PP}pp). Add tests to recover, or if the drop is intentional, lower the baseline in \`coverage-baseline.json\` deliberately.`
      )
    }
  }
}
const improved = rows.filter((r) => r.status === 'improved')
if (improved.length > 0) {
  lines.push('')
  lines.push(
    `Coverage improved beyond baseline + tolerance for: ${improved.map((r) => r.workspace).join(', ')}. Consider bumping \`coverage-baseline.json\` to lock in the gain.`
  )
}

const summary = `${lines.join('\n')}\n`
console.log(summary)
writeFileSync(join(reportDir, 'summary.md'), summary)

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
}

for (const { workspace, lcovPath } of results) {
  const dest = join(reportDir, `${workspace.replace(/\//g, '__')}.lcov.info`)
  copyFileSync(lcovPath, dest)
}

if (regressions.length > 0) {
  console.error(`Coverage ratchet FAILED for: ${regressions.map((r) => r.workspace).join(', ')}`)
  process.exit(1)
}

console.log('Coverage ratchet passed (no workspace dropped below its baseline).')
