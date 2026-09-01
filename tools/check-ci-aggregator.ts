#!/usr/bin/env bun

/**
 * ci-aggregator guard — proves the ONE required status check actually gates
 * every job in the CI workflow.
 *
 * WHY THIS EXISTS
 * ---------------
 * Branch protection on `main` requires `quality-checks`, the `if: always()`
 * aggregate job at the bottom of .github/workflows/ci.yml. Its verdict is a
 * loop over `join(needs.*.result, ' ')`, so it covers precisely the jobs named
 * in its hand-maintained `needs:` array, and NOTHING else. A job missing from
 * that list still runs, still goes red, and still cannot block the merge: it is
 * invisible to the only check anyone requires.
 *
 * That is the worst failure mode a gate can have — it does not break, it stops
 * gating, silently, and every PR keeps showing green. Nothing in GitHub Actions
 * warns about it, because a `needs:` list that omits a job is perfectly valid
 * YAML and a perfectly valid workflow. The omission is only visible to someone
 * diffing two lists by eye, which is exactly the review step that gets skipped
 * when a job is added under time pressure. So: diff the two lists mechanically,
 * on every `bun run check` and in CI.
 *
 * PRESENCE, NOT REACHABILITY. Most jobs here are path-filtered
 * (`if: needs.changes.outputs.code == 'true'`), and a filtered-out job is
 * perfectly fine — the aggregate's own step passes on `skipped` and fails only
 * on `failure`/`cancelled`. Being skipped is a runtime outcome the gate already
 * handles correctly; being absent from `needs:` is a structural hole. This
 * check therefore asserts membership and never reads a job's `if:`.
 *
 * SCOPE: ONE FILE. `needs:` cannot reach across workflows, so neither can this
 * check. Other workflows that are required status contexts in their own right
 * are listed in SEPARATELY_REQUIRED and reported on every run — a pass here is
 * "ci.yml is fully gated", never "main is fully gated".
 *
 * HARDCODES NOTHING ABOUT WHICH JOBS EXIST. Both sides of the diff are derived
 * from the workflow at runtime: the set of top-level `jobs:` keys, and the set
 * of `needs:` entries on the aggregate. Jobs get added, renamed and
 * consolidated; a guard carrying its own copy of the job list would just be a
 * third list to drift. The only fixed name is AGGREGATOR, which is the identity
 * of the required status check rather than a fact about the job graph.
 *
 * WHY A HAND-ROLLED PARSE AND NOT A YAML LIBRARY. There is no YAML parser in
 * this repo's dependencies, and adding one to read two lists out of one file
 * whose shape we control is not a trade worth making. The parse below is
 * deliberately narrow and hard-errors rather than guessing if ci.yml stops
 * looking the way it expects — a guard that silently parses zero jobs would
 * report success while checking nothing, which is the very failure it exists to
 * prevent.
 *
 * Exit codes: 0 — every job is gated; 1 — a job is un-gated, `needs:` carries a
 * stale entry, or the workflow could not be read in the shape this check
 * requires.
 *
 * Usage: bun run check:ci-aggregator
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const LABEL = 'check:ci-aggregator'

const WORKFLOW = '.github/workflows/ci.yml'

/**
 * The aggregate job's key. This is the required-status-check identity, not an
 * assumption about the job graph — if it is renamed, the branch ruleset for
 * `main` has to be updated in the same breath, and this check failing loudly is
 * the reminder to do it.
 */
const AGGREGATOR = 'quality-checks'

/**
 * Required status contexts that live in OTHER workflows and therefore cannot be
 * reached by `quality-checks.needs`. Reported on every run so a pass is never
 * mistaken for full coverage of `main`. Confirm context strings with:
 *   gh api repos/{owner}/{repo}/commits/main/check-runs --jq '.check_runs[].name'
 */
const SEPARATELY_REQUIRED = [
  {
    context: 'Analyze (javascript-typescript)',
    workflow: '.github/workflows/codeql.yml',
  },
] as const

/**
 * Jobs deliberately left out of the gate, each with the one-line reason it is
 * exempt. Empty today, and the bar for an entry is high: anything listed here
 * can go red without blocking a merge. An entry is a *documented* hole rather
 * than a silent one — which is the whole point of it being a list and not an
 * omission.
 */
const UNGATED_BY_DESIGN: Record<string, string> = {}

/** Job keys sit at exactly two spaces under the top-level `jobs:` mapping. */
const JOB_KEY = /^ {2}([A-Za-z0-9_-]+):[ \t]*(#.*)?$/

/** `    needs:` — a job property, so exactly four spaces. */
const NEEDS_KEY = /^ {4}needs:[ \t]*(.*)$/

/** `      - job-name` — a sequence item under `needs:`, six spaces. */
const NEEDS_ITEM = /^ {6}-[ \t]+([A-Za-z0-9_-]+)[ \t]*(#.*)?$/

/** Any other four-space job property (`runs-on:`, `steps:`, …) ends `needs:`. */
const NEEDS_END = /^ {4}[A-Za-z0-9_-]+:/

/** A block-scalar indicator (`run: |`, `filters: |`, `foo: >-`) opens literal content. */
const BLOCK_SCALAR = /^\s*[^#\s].*[|>][-+]?\d*[ \t]*$/

/** The workflow did not parse in the shape this check requires. */
export class WorkflowShapeError extends Error {}

/**
 * The `jobs:` block as plain lines, with comments, blanks and every
 * block-scalar BODY removed. The introducer (`run: |`, `if: >`) is kept — it is
 * a real key line, and dropping it silently un-terminates whatever list it
 * follows.
 *
 * Stripping the bodies is the whole reason this is a state machine and not a
 * grep: a `run: |` body is arbitrary text, and nothing stops a shell line
 * inside one from being shaped exactly like the YAML this parse is looking for.
 */
function jobsBlockLines(source: string): string[] {
  const lines = source.split('\n')

  const jobsAt = lines.findIndex((line) => /^jobs:[ \t]*(#.*)?$/.test(line))
  if (jobsAt === -1) {
    throw new WorkflowShapeError(`no top-level \`jobs:\` mapping found in ${WORKFLOW}.`)
  }

  const out: string[] = []
  let blockIndent: number | null = null

  for (let i = jobsAt + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const blank = line.trim() === ''
    const indent = line.length - line.trimStart().length

    // Inside a block scalar: everything more-indented than its introducer, and
    // every blank line, is opaque content.
    if (blockIndent !== null) {
      if (blank || indent > blockIndent) continue
      blockIndent = null
    }

    if (blank) continue
    if (line.trimStart().startsWith('#')) continue

    // A column-0 key ends the `jobs:` block — another top-level mapping is not
    // part of it.
    if (indent === 0) break

    if (BLOCK_SCALAR.test(line)) blockIndent = indent

    out.push(line)
  }

  return out
}

/** Every top-level job key in `jobs:`, in file order. */
export function workflowJobs(source: string): string[] {
  const jobs = jobsBlockLines(source).flatMap((line) => line.match(JOB_KEY)?.[1] ?? [])
  if (jobs.length === 0) {
    throw new WorkflowShapeError(
      `parsed zero jobs from ${WORKFLOW} — the parse is wrong, not the workflow.`
    )
  }
  return jobs
}

/**
 * One job's `needs:` entries. Handles both the inline flow form
 * (`needs: [changes]`) and the block sequence the aggregate uses.
 */
export function jobNeeds(source: string, job: string): Set<string> {
  const block = jobsBlockLines(source)
  const startAt = block.findIndex((line) => line.match(JOB_KEY)?.[1] === job)
  if (startAt === -1) throw new WorkflowShapeError(`no \`${job}\` job in ${WORKFLOW}.`)

  const needs = new Set<string>()
  let inNeeds = false

  for (const line of block.slice(startAt + 1)) {
    if (JOB_KEY.test(line)) break // next job — done with this one.

    const key = line.match(NEEDS_KEY)
    if (key) {
      inNeeds = true
      // Inline flow form: `needs: [a, b]`.
      const inline = (key[1] ?? '').trim()
      if (inline.startsWith('[')) {
        for (const raw of inline.replace(/^\[|][ \t]*$/g, '').split(',')) {
          const name = raw.trim().replace(/^['"]|['"]$/g, '')
          if (name) needs.add(name)
        }
        inNeeds = false
      }
      continue
    }

    if (!inNeeds) continue

    const item = line.match(NEEDS_ITEM)
    if (item?.[1]) needs.add(item[1])
    else if (NEEDS_END.test(line)) inNeeds = false
  }

  return needs
}

export type AggregatorReport = {
  /** Jobs that must be in `needs:` and are not — the gate has a hole. */
  missing: string[]
  /** `needs:` entries that are not jobs — a typo, or a job that was deleted. */
  stale: string[]
  /** Allowlisted jobs that turn out to be gated after all — the exemption is dead. */
  redundantExemptions: string[]
  /** Jobs actually covered by the gate. */
  gated: string[]
}

export function checkAggregator(
  source: string,
  aggregator = AGGREGATOR,
  exempt: Record<string, string> = UNGATED_BY_DESIGN
): AggregatorReport {
  const jobs = workflowJobs(source)
  if (!jobs.includes(aggregator)) {
    throw new WorkflowShapeError(
      `no \`${aggregator}\` job in ${WORKFLOW}.\n` +
        `  If the aggregate gate was renamed, update AGGREGATOR in this script AND the\n` +
        '  branch-protection ruleset for `main` — they are the same fact in two places.'
    )
  }

  const needs = jobNeeds(source, aggregator)
  if (needs.size === 0) {
    throw new WorkflowShapeError(
      `\`${aggregator}\` has no parseable \`needs:\` list.\n` +
        '  With an empty needs list the required check gates NOTHING at all.'
    )
  }

  // The aggregate is excluded from its own diff: a job cannot `needs:` itself,
  // so a naive key-set comparison would report the gate as ungated forever.
  const expected = jobs.filter((job) => job !== aggregator)

  return {
    missing: expected.filter((job) => !needs.has(job) && !(job in exempt)),
    stale: [...needs].filter((name) => !jobs.includes(name)),
    redundantExemptions: Object.keys(exempt).filter((job) => needs.has(job)),
    gated: expected.filter((job) => needs.has(job)),
  }
}

function scopeNote(): string[] {
  const lines = [
    `  Scope: ${WORKFLOW} only. \`needs:\` cannot reach across workflows, so neither can`,
    '  this check. Required contexts owned by other workflows are NOT covered:',
  ]
  for (const { context, workflow } of SEPARATELY_REQUIRED) {
    const missing = existsSync(join(repoRoot, workflow)) ? '' : '  ← FILE MISSING'
    lines.push(`    • ${context} (${workflow})${missing}`)
  }
  lines.push(
    '  Those are required as their own status contexts in the `main` ruleset. A pass',
    `  here means ${WORKFLOW} is fully gated, not that \`main\` is.`
  )
  return lines
}

function main(): void {
  let source: string
  try {
    source = readFileSync(join(repoRoot, WORKFLOW), 'utf8')
  } catch {
    console.error(`[${LABEL}] ERROR: cannot read ${WORKFLOW}.`)
    process.exit(1)
  }

  let report: AggregatorReport
  try {
    report = checkAggregator(source)
  } catch (error) {
    if (!(error instanceof WorkflowShapeError)) throw error
    console.error(`[${LABEL}] ERROR: ${error.message}`)
    process.exit(1)
  }

  const { missing, stale, redundantExemptions, gated } = report

  // A SEPARATELY_REQUIRED workflow that no longer exists is a hole, not a note.
  // This used to print `← FILE MISSING` inside the advisory scope note and then
  // exit 0 — a detector that declines to act. Delete `codeql.yml` while
  // `Analyze (javascript-typescript)` is still a required status context on
  // `main` and the required check simply never arrives: the PR is unmergeable
  // with nothing on it saying why, which is the same silent shape #742 hit.
  const missingWorkflows = SEPARATELY_REQUIRED.filter(
    ({ workflow }) => !existsSync(join(repoRoot, workflow))
  )
  if (missingWorkflows.length > 0) {
    console.error(`[${LABEL}] FAIL — a separately-required workflow file is gone.`)
    for (const { context, workflow } of missingWorkflows) {
      console.error(
        `  • ${workflow} does not exist, but \`${context}\` is still listed here as a\n` +
          '    required status context. Either restore the workflow, or remove it from\n' +
          '    SEPARATELY_REQUIRED in the same change that drops it from the ruleset.'
      )
    }
    process.exit(1)
  }

  if (missing.length === 0 && stale.length === 0 && redundantExemptions.length === 0) {
    console.log(`[${LABEL}] ✓ \`${AGGREGATOR}\` gates all ${gated.length} jobs in ${WORKFLOW}.`)
    for (const [job, reason] of Object.entries(UNGATED_BY_DESIGN)) {
      console.log(`  ! \`${job}\` is exempt by design — ${reason}`)
    }
    for (const line of scopeNote()) console.log(line)
    return
  }

  console.error(`[${LABEL}] FAIL — ${WORKFLOW}`)
  for (const job of missing) {
    console.error(
      `  • job \`${job}\` is NOT in \`${AGGREGATOR}.needs\` — it can never fail the required check.`
    )
  }
  for (const name of stale) {
    console.error(
      `  • \`${AGGREGATOR}.needs\` lists \`${name}\`, which is not a job — stale entry.`
    )
  }
  for (const job of redundantExemptions) {
    console.error(
      `  • \`${job}\` is in UNGATED_BY_DESIGN but IS gated — drop the dead exemption from this script.`
    )
  }
  console.error(
    `\n\`${AGGREGATOR}\` is the required status check for \`main\`, and it can only fail on a\n` +
      'job it `needs:`. Add every job to that list (or remove the stale entry):\n' +
      `  ${WORKFLOW} → ${AGGREGATOR}: → needs:`
  )
  process.exit(1)
}

if (import.meta.main) main()
