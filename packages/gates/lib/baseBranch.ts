/**
 * The branch this one merges into, for anything that measures "the branch":
 * pre-push's test selection (`tools/pre-push-test.ts`), the session status
 * hook (`.claude/hooks/session-status.sh`) and the open-pr skill's `--base`.
 *
 * Diffing against `origin/main` was right while every branch came off main.
 * A branch cut from a release branch such as `design-refresh` carries that
 * branch's whole diff against main: pre-push tested every workspace on each
 * push, and the status line counted the release branch's commits as this
 * one's. So the base is resolved, first answer wins:
 *
 *   1. `$SU_BASE`, set by hand (`main`, `origin/design-refresh`, …);
 *   2. the open PR's `base.ref`, through `gh api` REST (a cloud session's
 *      proxy refuses GraphQL), bounded by a timeout;
 *   3. the upstream, when it is another branch on origin (a branch tracking
 *      its own name on origin says nothing about its base);
 *   4. whichever of `main` and `design-refresh` HEAD is fewer commits ahead of
 *      (ties go to main).
 *
 * No answer at all is `null`; callers treat that as "no base", never as main.
 *
 *   bun packages/gates/lib/baseBranch.ts              print `<branch>\t<why>`
 *   bun packages/gates/lib/baseBranch.ts --no-pr      skip the PR lookup
 *   bun packages/gates/lib/baseBranch.ts --pr-base=X  the caller already looked
 */

/** The long-lived branches a branch can be cut from, in tie-break order. */
export const BASE_CANDIDATES = ['main', 'design-refresh'] as const

export type BaseSource = 'SU_BASE' | 'pr' | 'upstream' | 'nearest'

export type BaseBranch = {
  /** The branch name on origin, e.g. `design-refresh`. */
  branch: string
  /** The remote-tracking ref to diff against, e.g. `origin/design-refresh`. */
  ref: string
  source: BaseSource
}

export type BaseInputs = {
  /** `$SU_BASE`, if set. */
  suBase?: string | null
  /** The open PR's `base.ref`, if one was found. */
  prBase?: string | null
  /** The upstream as git abbreviates it, e.g. `origin/design-refresh`. */
  upstream?: string | null
  /** The checked-out branch, `null` when detached. */
  current?: string | null
  /** Commits HEAD is ahead of each candidate that exists on origin. */
  distances: ReadonlyMap<string, number>
}

const WHY: Record<BaseSource, string> = {
  SU_BASE: 'from $SU_BASE',
  pr: "the PR's base",
  upstream: 'the upstream',
  nearest: `nearest of ${BASE_CANDIDATES.join(' and ')}`,
}

/** A short phrase saying where a base came from, for status lines. */
export function describeBase(base: BaseBranch): string {
  return WHY[base.source]
}

const strip = (name: string) => name.trim().replace(/^(refs\/remotes\/)?origin\//, '')

function toBase(name: string, source: BaseSource): BaseBranch {
  const branch = strip(name)
  return { branch, ref: `origin/${branch}`, source }
}

/** The resolution order above, over inputs already gathered. */
export function pickBase(inputs: BaseInputs): BaseBranch | null {
  if (inputs.suBase?.trim()) return toBase(inputs.suBase, 'SU_BASE')
  if (inputs.prBase?.trim()) return toBase(inputs.prBase, 'pr')
  const upstream = inputs.upstream?.trim()
  if (upstream?.startsWith('origin/') && strip(upstream) !== inputs.current) {
    return toBase(upstream, 'upstream')
  }
  let nearest: string | null = null
  let best = Number.POSITIVE_INFINITY
  for (const candidate of BASE_CANDIDATES) {
    const distance = inputs.distances.get(candidate)
    if (distance !== undefined && distance < best) {
      nearest = candidate
      best = distance
    }
  }
  return nearest === null ? null : toBase(nearest, 'nearest')
}

/** `owner/repo` from the origin URL: https, ssh and the cloud git proxy all end in it. */
export function repoSlug(url: string): string | null {
  const match = url
    .trim()
    .replace(/\.git$/, '')
    .match(/[/:]([^/:]+\/[^/:]+)$/)
  return match?.[1] ?? null
}

/** stdout of a command that exited 0, else `null` (a missing binary included). */
type Env = Record<string, string | undefined>

async function run(cmd: string[], cwd: string, env: Env, timeout?: number) {
  try {
    const proc = Bun.spawn(cmd, {
      cwd,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'ignore',
      env: { ...env, GIT_TERMINAL_PROMPT: '0' },
      ...(timeout ? { timeout } : {}),
    })
    const [code, out] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
    return code === 0 ? out.trim() : null
  } catch {
    return null
  }
}

/** The open PR's base branch, or `null` (no gh, no PR, an error, the timeout). */
async function lookUpPrBase(cwd: string, env: Env, branch: string, timeout: number) {
  const url = await run(['git', 'remote', 'get-url', 'origin'], cwd, env)
  const repo = url ? repoSlug(url) : null
  if (!repo) return null
  const owner = repo.split('/')[0]
  const answer = await run(
    [
      'gh',
      'api',
      `repos/${repo}/pulls?state=open&head=${owner}:${branch}`,
      '--jq',
      '.[0].base.ref // empty',
    ],
    cwd,
    env,
    timeout
  )
  return answer || null
}

export type ResolveOptions = {
  cwd?: string
  /** `$SU_BASE` is read from it and git and gh run under it; default `process.env`. */
  env?: Env
  /**
   * The PR's base when the caller already looked it up; `null` skips the
   * lookup. Left out, `gh api` is asked, under `timeoutMs`.
   */
  prBase?: string | null
  timeoutMs?: number
}

/** Gather the inputs from git (and gh) and pick the base. */
export async function resolveBaseBranch(options: ResolveOptions = {}): Promise<BaseBranch | null> {
  const cwd = options.cwd ?? process.cwd()
  const env = options.env ?? process.env
  const suBase = env.SU_BASE
  if (suBase?.trim()) return pickBase({ suBase, distances: new Map() })

  const current = await run(['git', 'symbolic-ref', '--quiet', '--short', 'HEAD'], cwd, env)
  let prBase = options.prBase
  if (prBase === undefined) {
    prBase = current ? await lookUpPrBase(cwd, env, current, options.timeoutMs ?? 3000) : null
  }
  if (prBase?.trim()) return pickBase({ prBase, distances: new Map() })

  const [upstream, ...counts] = await Promise.all([
    run(['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], cwd, env),
    ...BASE_CANDIDATES.map((candidate) =>
      run(['git', 'rev-list', '--count', `origin/${candidate}..HEAD`], cwd, env)
    ),
  ])
  const distances = new Map<string, number>()
  BASE_CANDIDATES.forEach((candidate, i) => {
    const count = counts[i]
    if (count) distances.set(candidate, Number(count))
  })
  return pickBase({ upstream, current, distances })
}

/**
 * The CLI flags as `resolveBaseBranch`'s `prBase`: `--no-pr` is `null` (skip
 * the lookup), `--pr-base=X` is `X` (empty is `null`), neither is `undefined`.
 */
export function parseCliArgs(argv: readonly string[]): string | null | undefined {
  if (argv.includes('--no-pr')) return null
  const given = argv.find((arg) => arg.startsWith('--pr-base='))
  return given === undefined ? undefined : given.slice('--pr-base='.length) || null
}

/** The CLI's output line, `<branch>\t<why>`, or `null` when there is no base. */
export async function cliLine(argv: readonly string[], options: ResolveOptions = {}) {
  const resolved = await resolveBaseBranch({ ...options, prBase: parseCliArgs(argv) })
  return resolved && `${resolved.branch}\t${describeBase(resolved)}`
}

if (import.meta.main) {
  const line = await cliLine(process.argv.slice(2))
  if (line === null) process.exit(1)
  console.log(line)
}
