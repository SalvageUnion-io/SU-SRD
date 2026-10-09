#!/usr/bin/env bun
/**
 * The check runner — `bun run check`.
 *
 * ONE list of every gate in the repo, run in parallel, reported as a table.
 * `bun run check`, `bun run check:fast`, lefthook's pre-push and CI's
 * static-checks job all call this file with a different profile; none of them
 * keeps its own list.
 *
 * ## Why it exists
 *
 * One registry, read by `bun run check`, pre-push and CI: a gate that exists
 * in one hand-kept list and not another is a gate some path skips. Every check
 * runs and reports, so one failure never hides the results after it (an `&&`
 * chain would).
 *
 * ## Profiles
 *
 *   full      everything — `bun run check`
 *   fast      the ~12s inner loop: no test suite, no network, no
 *             regeneration — `bun run check:fast`
 *   pre-push  fast + generated-file drift (the suite runs separately, scoped by
 *             `--changed` — see lefthook.yml)
 *   ci        everything except the test suite, which runs in CI's own
 *             `coverage` job
 *
 * Positional ids run exactly those checks, whatever the profile:
 * `bun run check styling workflows`. `--list` prints the registry.
 *
 * ## Ordering
 *
 * `generated` REWRITES committed files to diff them, so it runs first and
 * alone; everything else runs after it, in parallel, heaviest first.
 *
 * Usage:
 *   bun tools/check.ts                          # full
 *   bun tools/check.ts --profile=fast
 *   bun tools/check.ts styling workflows        # just these
 *   bun tools/check.ts --profile=ci --areas=code,docs,deps
 *   bun tools/check.ts --skip=audit --jobs=4
 *   bun tools/check.ts --list
 */

import { availableParallelism } from 'node:os'
import { join } from 'node:path'

export type Profile = 'full' | 'fast' | 'pre-push' | 'ci'
export type Area = 'code' | 'docs' | 'deps'
const AREAS: readonly Area[] = ['code', 'docs', 'deps']

export type CheckSpec = {
  id: string
  /** What it guards, one line — printed by `--list`. */
  guards: string
  /** How to fix a failure, one line — printed under the failure banner and by `--list`. */
  fix: string
  cmd: string[]
  /** Repo-relative working directory; the root when absent. */
  cwd?: string
  /** Runs alone before everything else, because it writes files others read. */
  first?: boolean
  /**
   * CI path-filter areas that make this check relevant (`--areas`). Absent
   * means always. Locally, with no `--areas`, every area is active.
   */
  areas?: readonly Area[]
  profiles: readonly Profile[]
}

const ALL: readonly Profile[] = ['full', 'fast', 'pre-push', 'ci']
const REPO_INVARIANT: readonly Area[] = ['code', 'docs']

/**
 * The registry. Order is launch order, so the long-running checks start first.
 * To add a gate, add it HERE — nowhere else lists checks.
 */
export const CHECKS: readonly CheckSpec[] = [
  {
    id: 'generated',
    guards:
      'committed generated files match their generators (schemas, docs, registry, route tree)',
    fix: 'commit the files it just regenerated; never hand-edit a generated file',
    cmd: ['bun', 'tools/check-generated.ts'],
    first: true,
    areas: ['code'],
    profiles: ['full', 'pre-push', 'ci'],
  },
  {
    id: 'test',
    guards: 'the full test suite, every workspace (tools/ is one)',
    fix: 'fix the test; `bun --filter <workspace> test` reruns one workspace',
    cmd: ['bun', 'run', 'test'],
    profiles: ['full'],
  },
  {
    id: 'typecheck',
    guards: 'TypeScript across every workspace and test/',
    fix: 'fix the type error',
    cmd: ['bun', 'run', 'typecheck'],
    areas: ['code'],
    profiles: ALL,
  },
  {
    id: 'knip',
    guards: 'no unused files, exports or dependencies',
    fix: 'delete what it lists; the /knip-triage skill covers the two exceptions',
    cmd: ['bun', 'run', 'knip'],
    areas: ['code'],
    profiles: ALL,
  },
  {
    id: 'biome',
    guards: 'lint, format, import order and the GritQL rules in tools/biome/ (`biome ci .`)',
    fix: '`bun run format`, then fix what remains',
    cmd: ['bunx', 'biome', 'ci', '.'],
    profiles: ALL,
  },
  {
    id: 'data',
    guards: 'the reference dataset: ids, slugs, references, orphans, parity, …',
    fix: 'fix the data: each diagnostic names the file and record',
    cmd: ['bun', 'tools/validate.ts'],
    cwd: 'packages/salvageunion-reference',
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'doc-drift',
    guards:
      'cited paths, bun scripts and markdown links exist (live docs plus each ADR Status and Decision); no agent doc repeats a retired claim; each ADR once in ARCHITECTURE.md and named in the Status of any ADR it amends; agent-doc size budgets',
    fix: 'fix the path, script or link; mark a deliberately historical path beside it ("`x.ts` (since deleted)"); state the current design instead of a retired claim; keep each ADR one bare `## ADR-NNN` under # Decisions; add the amending ADR to the amended one\'s Status; cut a doc over its size budget',
    cmd: ['bun', 'tools/check-doc-drift.ts'],
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'observability',
    guards: 'Sentry can report: DSN gating, CSP ingest host, Worker wrapping',
    fix: 'change the CSP and Sentry wiring in every source for that app together',
    cmd: ['bun', 'tools/check-observability.ts'],
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'convex-callers',
    guards:
      'every public Convex function has a shipped caller; api.d.ts registers the modules on disk',
    fix: 'delete the function or make it `internal*`; for api.d.ts drift, regenerate with `bunx convex dev`',
    cmd: ['bun', 'tools/check-convex-callers.ts'],
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'client-contract',
    guards:
      'a Convex argument change that refuses calls an open ITUN tab still makes raises the build floor',
    fix: 'keep it compatible (optional argument, keep the old function) or raise BUILD_FLOOR in apps/itun/convex/buildFloor.ts to `date +%s`; then `bun tools/check-client-contract.ts --write`',
    cmd: ['bun', 'tools/check-client-contract.ts'],
    areas: ['code'],
    profiles: ALL,
  },
  {
    id: 'barrel-consumers',
    guards:
      'every component-lib export has an app importer, and none is a composition only one app renders',
    fix: "move a single-app composition into that app's src/components/; unexport what no app imports; a storyless single-app helper needs a SINGLE_APP reason",
    cmd: ['bun', 'tools/check-barrel-consumers.ts'],
    areas: ['code'],
    profiles: ALL,
  },
  {
    id: 'workflows',
    guards:
      'CI aggregate gate, path filters, bunx pinning, Bun version, Convex deploy guard, deploy order, production-secret env',
    fix: 'each message names the file and the fix; `bun tools/check-workflows.ts --only=<id>` reruns one',
    cmd: ['bun', 'tools/check-workflows.ts'],
    // Reads only .github/ and the manifests, all of them `code`.
    areas: ['code'],
    profiles: ALL,
  },
  {
    id: 'styling',
    guards: 'design tokens, styling ownership, srd stylesheet entry (ratcheted)',
    fix: "follow the rule's printed fix; a ratchet that fell needs `bun tools/check-styling.ts --update-baseline`",
    cmd: ['bun', 'tools/check-styling.ts'],
    profiles: ALL,
  },
  {
    id: 'audit',
    guards: 'no advisory, at any severity, in the dependency tree',
    fix: 'upgrade or override the vulnerable package (docs/ARCHITECTURE.md#dependency-audit)',
    // The root `audit` script, which e2e-nightly.yml's `audit` job also runs:
    // one command, one suppression list (docs/ARCHITECTURE.md#dependency-audit).
    cmd: ['bun', 'run', 'audit'],
    // A PR that moves neither bun.lock nor a manifest cannot change the tree;
    // the nightly run catches a new advisory against the unchanged one.
    areas: ['deps'],
    profiles: ['full', 'ci'],
  },
  {
    id: 'actionlint',
    guards: 'actionlint + zizmor over .github/ (pinned, hash-verified binaries)',
    fix: "fix the finding; zizmor's config is .github/zizmor.yml",
    cmd: ['tools/lint-workflows.sh'],
    // Reads only .github/ (workflows, actions and its two config files), all `code`.
    areas: ['code'],
    profiles: ['full', 'ci'],
  },
]

export const CHECK_IDS: readonly string[] = CHECKS.map((c) => c.id)

export type Options = {
  ids: string[]
  profile: Profile
  /** Active areas; null means every area (a local run). */
  areas: Area[] | null
  skip: string[]
  jobs: number
  list: boolean
  verbose: boolean
}

export class UsageError extends Error {}

export function parseArgs(argv: readonly string[]): Options {
  const opts: Options = {
    ids: [],
    profile: 'full',
    areas: null,
    skip: [],
    jobs: Math.max(2, availableParallelism()),
    list: false,
    verbose: false,
  }
  for (const arg of argv) {
    const [flag, value = ''] = arg.split('=', 2) as [string, string | undefined]
    if (flag === '--profile') {
      if (!(ALL as readonly string[]).includes(value)) {
        throw new UsageError(`unknown profile "${value}" (known: ${ALL.join(', ')})`)
      }
      opts.profile = value as Profile
    } else if (flag === '--fast') opts.profile = 'fast'
    else if (flag === '--areas') {
      const areas = value.split(',').filter(Boolean)
      const bad = areas.filter((a) => !(AREAS as readonly string[]).includes(a))
      if (bad.length > 0)
        throw new UsageError(`unknown area(s): ${bad.join(', ')} (known: ${AREAS.join(', ')})`)
      opts.areas = areas as Area[]
    } else if (flag === '--skip') opts.skip = value.split(',').filter(Boolean)
    else if (flag === '--jobs') {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1)
        throw new UsageError(`--jobs needs a positive integer, got "${value}"`)
      opts.jobs = n
    } else if (flag === '--list') opts.list = true
    else if (flag === '--verbose') opts.verbose = true
    else if (flag.startsWith('-')) throw new UsageError(`unknown flag ${flag}`)
    else opts.ids.push(arg)
  }
  const unknown = [...opts.ids, ...opts.skip].filter((id) => !CHECK_IDS.includes(id))
  if (unknown.length > 0) {
    throw new UsageError(`unknown check(s): ${unknown.join(', ')}. Run with --list to see them.`)
  }
  return opts
}

/** The checks a run executes, in launch order. */
export function selectChecks(registry: readonly CheckSpec[], opts: Options): CheckSpec[] {
  return registry.filter((c) => {
    if (opts.skip.includes(c.id)) return false
    if (opts.ids.length > 0) return opts.ids.includes(c.id)
    if (!c.profiles.includes(opts.profile)) return false
    if (opts.areas === null || c.areas === undefined) return true
    return c.areas.some((a) => opts.areas?.includes(a))
  })
}

export type CheckResult = { id: string; code: number; seconds: number; output: string }

async function runOne(spec: CheckSpec, root: string): Promise<CheckResult> {
  const started = performance.now()
  let proc: Bun.Subprocess<'ignore', 'pipe', 'pipe'>
  try {
    proc = Bun.spawn(spec.cmd, {
      cwd: join(root, spec.cwd ?? '.'),
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0' },
    })
  } catch (error) {
    // A command that cannot be spawned (missing binary, bad cwd) is a failed
    // check, not a crash that loses every other result — 127 as a shell would.
    return {
      id: spec.id,
      code: 127,
      seconds: (performance.now() - started) / 1000,
      output: `could not spawn \`${spec.cmd.join(' ')}\`: ${(error as Error).message}`,
    }
  }
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return {
    id: spec.id,
    code,
    seconds: (performance.now() - started) / 1000,
    output: `${out}${err}`.trimEnd(),
  }
}

/**
 * Run `first` checks one at a time, then the rest with at most `jobs` in
 * flight. `onDone` fires as each finishes.
 */
export async function runChecks(
  specs: readonly CheckSpec[],
  opts: { root: string; jobs: number; onDone?: (r: CheckResult) => void }
): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const finish = (r: CheckResult) => {
    results.push(r)
    opts.onDone?.(r)
  }
  for (const spec of specs.filter((s) => s.first)) finish(await runOne(spec, opts.root))
  const queue = specs.filter((s) => !s.first)
  const workers = Array.from({ length: Math.min(opts.jobs, queue.length) }, async () => {
    for (let spec = queue.shift(); spec; spec = queue.shift()) finish(await runOne(spec, opts.root))
  })
  await Promise.all(workers)
  const order = new Map(specs.map((s, i) => [s.id, i]))
  return results.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

/** A failed check's report: the banner, the registry's fix hint, then the check's own output. */
export function formatFailure(result: CheckResult, fix: string): string {
  return [
    `━━━ ${result.id} failed (exit ${result.code}) ━━━`,
    `fix: ${fix}`,
    '',
    result.output || '(no output)',
  ].join('\n')
}

export function formatTable(results: readonly CheckResult[]): string {
  const width = Math.max(...results.map((r) => r.id.length), 5)
  const rows = results.map(
    (r) =>
      `  ${r.code === 0 ? '✓' : '✗'} ${r.id.padEnd(width)}  ${r.seconds.toFixed(1).padStart(5)}s`
  )
  const failed = results.filter((r) => r.code !== 0).length
  const summary =
    failed === 0 ? `all ${results.length} passed` : `${failed} of ${results.length} FAILED`
  return [...rows, '', `  ${summary}`].join('\n')
}

async function main(argv: readonly string[]): Promise<number> {
  let opts: Options
  try {
    opts = parseArgs(argv)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    console.error(`✗ ${error.message}`)
    return 2
  }
  if (opts.list) {
    const width = Math.max(...CHECKS.map((c) => c.id.length))
    for (const c of CHECKS) {
      console.log(`${c.id.padEnd(width)}  [${c.profiles.join(' ')}]  ${c.guards}`)
      console.log(`${' '.repeat(width)}  fix: ${c.fix}`)
    }
    return 0
  }
  const specs = selectChecks(CHECKS, opts)
  if (specs.length === 0) {
    console.error('✗ no checks selected')
    return 2
  }
  const label = opts.ids.length > 0 ? opts.ids.join(' ') : `profile ${opts.profile}`
  const areas = opts.areas === null ? '' : ` (areas: ${opts.areas.join(', ') || 'none'})`
  console.log(`Running ${specs.length} check(s) — ${label}${areas}`)

  // Nothing streams on success: the table at the end is the whole report.
  const ci = process.env.GITHUB_ACTIONS === 'true'
  const results = await runChecks(specs, {
    root: join(import.meta.dir, '..'),
    jobs: opts.jobs,
    onDone: (r) => {
      if (r.code !== 0 || !r.output) return
      if (opts.verbose) console.log(`${r.id}:\n${indent(r.output)}`)
      if (ci) {
        console.log(`::group::${r.id} output`)
        console.log(r.output)
        console.log('::endgroup::')
      }
    },
  })

  const fixOf = new Map(specs.map((s) => [s.id, s.fix]))
  for (const r of results.filter((x) => x.code !== 0)) {
    const fix = fixOf.get(r.id) ?? ''
    if (ci) console.log(`::error title=check ${r.id} failed::${fix}`)
    console.log(`\n${formatFailure(r, fix)}`)
  }
  console.log(`\n${formatTable(results)}`)
  return results.every((r) => r.code === 0) ? 0 : 1
}

const indent = (text: string) =>
  text
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n')

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
