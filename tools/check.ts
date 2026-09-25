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
 * There used to be three hand-kept lists, and they disagreed. `validate:all`
 * was an 11-step `&&` chain, so the first failure hid every result after it —
 * a Bun-version mismatch masked nine other checks. `check:tokens`,
 * `check:styling` and `check:ci-aggregator` sat outside that chain and were
 * listed again in `check`, again in `ci.yml` and again in `lefthook.yml`, and
 * pre-push had quietly never run the CI-aggregator gate. A gate that exists in
 * one list and not another is a gate some path skips.
 *
 * ## Profiles
 *
 *   full      everything — `bun run check`
 *   fast      the ~12s inner loop: no test suite, no srd build, no network,
 *             no regeneration — `bun run check:fast`
 *   pre-push  fast + generated-file drift (the suite runs separately, scoped by
 *             `--changed` — see lefthook.yml)
 *   ci        everything except the test suite and the srd build, which run in
 *             CI's own `coverage` and `build-srd` jobs
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
 *   bun tools/check.ts --profile=ci --areas=code,docs
 *   bun tools/check.ts --skip=audit --jobs=4
 *   bun tools/check.ts --list
 */

import { availableParallelism } from 'node:os'
import { join } from 'node:path'

export type Profile = 'full' | 'fast' | 'pre-push' | 'ci'
export type Area = 'code' | 'docs'

export type CheckSpec = {
  id: string
  /** What it guards, one line — printed by `--list`. */
  guards: string
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
    cmd: ['bun', 'tools/check-generated.ts'],
    first: true,
    areas: ['code'],
    profiles: ['full', 'pre-push', 'ci'],
  },
  {
    id: 'test',
    guards: 'the full test suite, every workspace plus tools/',
    cmd: ['bun', 'run', 'test'],
    profiles: ['full'],
  },
  {
    id: 'srd-output',
    guards: 'the built srd site matches its committed output snapshot',
    cmd: ['bun', '--filter', 'srd', 'gate'],
    profiles: ['full'],
  },
  {
    id: 'typecheck',
    guards: 'TypeScript across every workspace and tools/',
    cmd: ['bun', 'run', 'typecheck'],
    areas: ['code'],
    profiles: ALL,
  },
  {
    id: 'knip',
    guards: 'no unused files, exports or dependencies',
    cmd: ['bun', 'run', 'knip'],
    areas: ['code'],
    profiles: ALL,
  },
  {
    id: 'biome',
    guards: 'lint, format and import order (`biome ci .`)',
    cmd: ['bunx', 'biome', 'ci', '.'],
    profiles: ALL,
  },
  {
    id: 'data',
    guards: 'the reference dataset: ids, slugs, references, schemas, parity, …',
    cmd: ['bun', 'tools/validate.ts'],
    cwd: 'packages/salvageunion-reference',
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'doc-drift',
    guards: 'live docs, skills and rules stay true to the tree',
    cmd: ['bun', 'tools/check-doc-drift.ts'],
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'architecture',
    guards: 'no module-scope ORM calls, no inlined pool defaults, component-lib size cap',
    cmd: ['bun', 'tools/check-architecture.ts'],
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'observability',
    guards: 'Sentry can report: DSN gating, CSP ingest host, Worker wrapping',
    cmd: ['bun', 'tools/check-observability.ts'],
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'convex-codegen',
    guards: 'convex/_generated/api.d.ts registers exactly the modules on disk',
    cmd: ['bun', 'tools/check-convex-codegen.ts'],
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'convex-callers',
    guards: 'every public Convex function has a shipped caller',
    cmd: ['bun', 'tools/check-convex-callers.ts'],
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'catalog',
    guards: 'workspaces.catalog: shared deps declared once, no orphans',
    cmd: ['bun', 'tools/check-catalog.ts'],
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'worker-env',
    guards: "each Worker's Env type matches its wrangler.jsonc bindings",
    cmd: ['bun', 'tools/check-worker-env.ts'],
    areas: REPO_INVARIANT,
    profiles: ALL,
  },
  {
    id: 'workflows',
    guards: 'CI aggregate gate, path filters, SHA pinning, Bun version, Convex deploy guard',
    cmd: ['bun', 'tools/check-workflows.ts'],
    profiles: ALL,
  },
  {
    id: 'styling',
    guards: 'design tokens, styling ownership, srd stylesheet entry (ratcheted)',
    cmd: ['bun', 'tools/check-styling.ts'],
    profiles: ALL,
  },
  {
    id: 'audit',
    guards: 'no high-severity advisory in the dependency tree',
    cmd: ['bun', 'audit', '--audit-level=high'],
    areas: ['code'],
    profiles: ['full', 'ci'],
  },
  {
    id: 'actionlint',
    guards: 'actionlint + zizmor over .github/ (pinned, hash-verified binaries)',
    cmd: ['tools/lint-workflows.sh'],
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
      const bad = areas.filter((a) => a !== 'code' && a !== 'docs')
      if (bad.length > 0)
        throw new UsageError(`unknown area(s): ${bad.join(', ')} (known: code, docs)`)
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
 * flight. `onDone` fires as each finishes, so progress is visible live.
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
  console.log(`Running ${specs.length} check(s) — ${label}${areas}\n`)

  const ci = process.env.GITHUB_ACTIONS === 'true'
  const results = await runChecks(specs, {
    root: join(import.meta.dir, '..'),
    jobs: opts.jobs,
    onDone: (r) => {
      console.log(`${r.code === 0 ? '✓' : '✗'} ${r.id} (${r.seconds.toFixed(1)}s)`)
      if (r.code === 0 && opts.verbose && r.output) console.log(indent(r.output))
      if (r.code === 0 && ci && r.output) {
        console.log(`::group::${r.id} output`)
        console.log(r.output)
        console.log('::endgroup::')
      }
    },
  })

  for (const r of results.filter((x) => x.code !== 0)) {
    console.log(`\n━━━ ${r.id} failed (exit ${r.code}) ━━━`)
    if (ci) console.log(`::error title=check ${r.id} failed::bun tools/check.ts ${r.id}`)
    console.log(r.output || '(no output)')
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
