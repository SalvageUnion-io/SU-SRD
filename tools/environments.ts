#!/usr/bin/env bun
/**
 * GitHub Environments, declared once — `bun tools/environments.ts`.
 *
 * The declaration below is the one source for which Environments the repo has,
 * which branches each admits and which secrets it must hold. `check-workflows.ts`
 * (`secrets-env`) reads it statically on every PR; this script compares it
 * against the live repository settings and, with `--apply`, makes the settings
 * that are safe to automate match it.
 *
 * ## Why it exists
 *
 * #1072 (audit-3 P2) declared `environment: production` on every job that reads
 * a deploy secret and added the static gate, on the premise that the secrets
 * live only in an Environment restricted to `main`. The settings half was a
 * manual step in the PR body and never happened: on 2026-10-07 `production`
 * existed with no branch policy and no secrets, all four deploy secrets were
 * still repository-wide (readable by a workflow copy dispatched from any
 * branch), and the gate was green the whole time because it can only read
 * YAML. Settings changed by hand drift silently; this makes the drift red.
 *
 * ## What it checks
 *
 *   - every declared Environment exists, with a custom deployment branch
 *     policy admitting exactly its declared branches;
 *   - no Environment exists that is not declared (a leftover from a retired
 *     host still shows up on deployments and in the Environments picker);
 *   - each declared secret name exists on its Environment;
 *   - no secret exists at repository level beyond `REPOSITORY_SECRETS` — a
 *     repo-level copy is readable outside the Environment, which is the whole
 *     hole;
 *   - with `--secrets-from-env`: none of the Environment secrets is readable
 *     in this process (CI maps them into a job that has NO environment, so a
 *     non-empty value can only be a repository- or organisation-level copy).
 *
 * Listing secret names needs a token with admin read on the repo: the owner's
 * `gh` has it, Actions' GITHUB_TOKEN does not. A check the token cannot make is
 * printed as not run, never passed silently; the nightly job covers the
 * repository-level half with `--secrets-from-env` instead.
 *
 * It never reads, prints or writes a secret value. `--apply` creates or updates
 * Environments and their branch policies and nothing else: it prints the
 * `gh secret set` / `gh secret delete` / Environment delete commands for the
 * owner rather than running them.
 *
 * Usage:
 *   bun tools/environments.ts                      # compare live settings (exit 1 on drift)
 *   bun tools/environments.ts --apply              # create/update Environments + branch policies
 *   bun tools/environments.ts --secrets-from-env   # also fail on a secret readable outside its Environment
 */

export const REPO = 'SalvageUnion-io/SU-SRD'

export type EnvironmentSpec = {
  name: string
  /** The only branches allowed to deploy to it (a custom deployment branch policy). */
  branches: readonly string[]
  /** Secret names it must hold. Values never live in the repo. */
  secrets: readonly string[]
}

export const ENVIRONMENTS: readonly EnvironmentSpec[] = [
  {
    // Every job that can act on production. No reviewers: a deploy is gated
    // on CI succeeding for the same commit on `main` (ADR-033 §Credentials).
    name: 'production',
    branches: ['main'],
    secrets: [
      'CLOUDFLARE_API_TOKEN',
      'CONVEX_DEPLOY_KEY',
      'SENTRY_AUTH_TOKEN',
      'RELEASE_PLEASE_TOKEN',
    ],
  },
]

/** Secrets allowed at repository level, readable from any branch. Keep it empty. */
export const REPOSITORY_SECRETS: readonly string[] = []

/**
 * The one job that maps Environment secrets WITHOUT declaring the Environment,
 * so that a value it can read proves a repository-level copy exists.
 * `secrets-env` exempts it and requires it to stay outside every Environment.
 */
export const SECRET_SENTINEL = { file: '.github/workflows/e2e-nightly.yml', job: 'environments' }

/** What the live repository reports. `null` means the token could not read it. */
export type LiveEnvironment = {
  name: string
  /** `custom` = custom branch policies; `protected` = protected branches; `none` = any branch. */
  policy: 'custom' | 'protected' | 'none'
  branches: string[] | null
  secrets: string[] | null
}

export type LiveState = {
  environments: LiveEnvironment[]
  repositorySecrets: string[] | null
  /** Secret names with a non-empty value in this process; null when not asked. */
  readableOutside: string[] | null
}

export type Verdict = { failures: string[]; notRun: string[]; ran: string[] }

const sorted = (xs: readonly string[]) => [...xs].sort()
const same = (a: readonly string[], b: readonly string[]) =>
  JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))

/** Pure comparison of the declaration against a live snapshot. */
export function compare(
  spec: readonly EnvironmentSpec[],
  allowedRepoSecrets: readonly string[],
  live: LiveState
): Verdict {
  const failures: string[] = []
  const notRun: string[] = []
  const ran: string[] = []
  const byName = new Map(live.environments.map((e) => [e.name, e]))

  if (spec.length === 0)
    failures.push('no Environment is declared — this would pass by doing nothing')

  for (const want of spec) {
    const have = byName.get(want.name)
    if (!have) {
      failures.push(
        `Environment \`${want.name}\` does not exist — run \`bun tools/environments.ts --apply\``
      )
      continue
    }
    if (have.policy !== 'custom') {
      failures.push(
        `Environment \`${want.name}\` admits ${have.policy === 'none' ? 'every branch' : 'every protected branch'}, ` +
          `not only ${want.branches.join(', ')} — run \`bun tools/environments.ts --apply\``
      )
    } else if (have.branches && !same(have.branches, want.branches)) {
      failures.push(
        `Environment \`${want.name}\` admits [${sorted(have.branches).join(', ')}], declared ` +
          `[${sorted(want.branches).join(', ')}] — run \`bun tools/environments.ts --apply\``
      )
    }
    ran.push(`${want.name}: branch policy`)

    if (have.secrets === null) {
      notRun.push(`${want.name}: secret names (this token cannot list secrets)`)
    } else {
      ran.push(`${want.name}: secret names`)
      for (const name of want.secrets.filter((s) => !have.secrets?.includes(s))) {
        failures.push(
          `Environment \`${want.name}\` has no secret ${name} — ` +
            `\`gh secret set ${name} --env ${want.name} --repo ${REPO}\` (prompts for the value)`
        )
      }
      for (const name of have.secrets.filter((s) => !want.secrets.includes(s))) {
        failures.push(
          `Environment \`${want.name}\` holds undeclared secret ${name} — declare it in ` +
            `tools/environments.ts or \`gh secret delete ${name} --env ${want.name} --repo ${REPO}\``
        )
      }
    }
  }

  const declared = new Set(spec.map((e) => e.name))
  for (const extra of live.environments.filter((e) => !declared.has(e.name))) {
    failures.push(
      `Environment \`${extra.name}\` is not declared — declare it in tools/environments.ts or ` +
        `\`gh api -X DELETE "repos/${REPO}/environments/${encodeURIComponent(extra.name)}"\``
    )
  }
  ran.push('no undeclared Environment')

  const envSecrets = new Set(spec.flatMap((e) => e.secrets))
  if (live.repositorySecrets === null) {
    notRun.push('repository secrets (this token cannot list secrets)')
  } else {
    ran.push('repository secrets')
    for (const name of live.repositorySecrets.filter((s) => !allowedRepoSecrets.includes(s))) {
      failures.push(
        envSecrets.has(name)
          ? `${name} is still a repository secret, readable from any branch — once the Environment ` +
              `holds it: \`gh secret delete ${name} --repo ${REPO}\``
          : `${name} is an undeclared repository secret — add it to REPOSITORY_SECRETS or ` +
              `\`gh secret delete ${name} --repo ${REPO}\``
      )
    }
  }

  if (live.readableOutside !== null) {
    ran.push(`${envSecrets.size} Environment secret(s) unreadable outside their Environment`)
    for (const name of live.readableOutside.filter((s) => envSecrets.has(s))) {
      failures.push(
        `${name} is readable by a job with no Environment, so a repository- or organisation-level ` +
          'copy exists — delete that copy; the Environment keeps its own'
      )
    }
  }

  return { failures, notRun, ran }
}

// ─── live reads and writes (gh api) ─────────────────────────────────────────

type GhResult = { ok: true; json: unknown } | { ok: false; status: number | null; message: string }

function gh(args: string[], input?: unknown): GhResult {
  const proc = Bun.spawnSync(
    ['gh', 'api', ...args, ...(input === undefined ? [] : ['--input', '-'])],
    {
      stdin: input === undefined ? 'ignore' : new TextEncoder().encode(JSON.stringify(input)),
      stdout: 'pipe',
      stderr: 'pipe',
    }
  )
  const out = proc.stdout.toString()
  if (proc.exitCode === 0) return { ok: true, json: out.trim() ? JSON.parse(out) : null }
  const message = `${proc.stderr.toString()}${out}`.trim()
  const status = Number(/HTTP (\d{3})/.exec(message)?.[1] ?? Number.NaN)
  return { ok: false, status: Number.isNaN(status) ? null : status, message }
}

function must(res: GhResult, what: string): unknown {
  if (res.ok) return res.json
  throw new Error(`${what}: ${res.message}`)
}

/** A secret listing the token may not be allowed to read: 403/404 → null. */
function secretNames(path: string): string[] | null {
  const res = gh([`${path}?per_page=100`])
  if (!res.ok && (res.status === 403 || res.status === 404)) return null
  const body = must(res, `GET ${path}`) as { secrets: { name: string }[] }
  return body.secrets.map((s) => s.name)
}

type ApiEnvironment = {
  name: string
  deployment_branch_policy: { protected_branches: boolean; custom_branch_policies: boolean } | null
}

function branchPolicies(env: string): { id: number; name: string; type?: string }[] {
  const body = must(
    gh([
      `repos/${REPO}/environments/${encodeURIComponent(env)}/deployment-branch-policies?per_page=100`,
    ]),
    `GET ${env} branch policies`
  ) as { branch_policies: { id: number; name: string; type?: string }[] }
  return body.branch_policies
}

export function readLive(secretsFromEnv: boolean): LiveState {
  const body = must(gh([`repos/${REPO}/environments?per_page=100`]), 'GET environments') as {
    environments: ApiEnvironment[]
  }
  const declared = new Set(ENVIRONMENTS.map((e) => e.name))
  const environments = body.environments.map((e): LiveEnvironment => {
    const p = e.deployment_branch_policy
    const policy = !p ? 'none' : p.custom_branch_policies ? 'custom' : 'protected'
    const tracked = declared.has(e.name)
    return {
      name: e.name,
      policy,
      branches:
        tracked && policy === 'custom'
          ? branchPolicies(e.name)
              .filter((b) => (b.type ?? 'branch') === 'branch')
              .map((b) => b.name)
          : null,
      secrets: tracked
        ? secretNames(`repos/${REPO}/environments/${encodeURIComponent(e.name)}/secrets`)
        : null,
    }
  })
  const envSecrets = ENVIRONMENTS.flatMap((e) => e.secrets)
  return {
    environments,
    repositorySecrets: secretNames(`repos/${REPO}/actions/secrets`),
    readableOutside: secretsFromEnv
      ? envSecrets.filter((name) => (process.env[name] ?? '') !== '')
      : null,
  }
}

/** Create/update each declared Environment and its branch policies. Never touches secrets. */
export function apply(): string[] {
  const done: string[] = []
  for (const env of ENVIRONMENTS) {
    const path = `repos/${REPO}/environments/${encodeURIComponent(env.name)}`
    must(
      gh(['-X', 'PUT', path], {
        deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
      }),
      `PUT ${env.name}`
    )
    done.push(`${env.name}: custom deployment branch policy`)
    const have = branchPolicies(env.name)
    for (const branch of env.branches.filter((b) => !have.some((h) => h.name === b))) {
      must(
        gh(['-X', 'POST', `${path}/deployment-branch-policies`], { name: branch, type: 'branch' }),
        `POST ${env.name} branch policy ${branch}`
      )
      done.push(`${env.name}: admits ${branch}`)
    }
    for (const stale of have.filter((h) => !env.branches.includes(h.name))) {
      must(
        gh(['-X', 'DELETE', `${path}/deployment-branch-policies/${stale.id}`]),
        `DELETE ${stale.name}`
      )
      done.push(`${env.name}: no longer admits ${stale.name}`)
    }
  }
  return done
}

function main() {
  const args = new Set(process.argv.slice(2))
  for (const a of args) {
    if (!['--apply', '--secrets-from-env'].includes(a)) {
      console.error(`unknown argument ${a}`)
      process.exit(2)
    }
  }
  if (args.has('--apply')) {
    for (const line of apply()) console.log(`applied  ${line}`)
  }
  const verdict = compare(
    ENVIRONMENTS,
    REPOSITORY_SECRETS,
    readLive(args.has('--secrets-from-env'))
  )
  for (const line of verdict.ran) console.log(`checked  ${line}`)
  for (const line of verdict.notRun) console.log(`not run  ${line}`)
  if (verdict.failures.length) {
    console.error(`\n${verdict.failures.length} drift(s) from tools/environments.ts:`)
    for (const f of verdict.failures) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log(`\n${REPO}: GitHub Environments match tools/environments.ts`)
}

if (import.meta.main) main()
