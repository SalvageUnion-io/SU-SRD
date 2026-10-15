#!/usr/bin/env bun
/**
 * Workflow invariants — `bun run check workflows`.
 *
 * Five properties of `.github/` that no linter holds, checked from one parse
 * of every workflow and composite action, with `Bun.YAML.parse`: a hand-written
 * YAML state machine can be fooled by a `run: |` body shaped like YAML; a real
 * parse cannot be. What actionlint and zizmor (`bun run check actionlint`) do
 * hold — syntax, expressions, action SHA pins — is theirs, and the Bun version
 * is setup-bun's (it reads `packageManager`).
 *
 *   aggregator    `CI Success` (`quality-checks` in ci.yml) `needs:` every job
 *                 in ci.yml. It is ci.yml's one required status check, and it
 *                 can only fail on a job it needs — a job missing from that
 *                 list still runs, still goes red, and cannot block a merge.
 *                 The `main` ruleset declared in tools/environments.ts must
 *                 require it, and every other gate that ruleset waits on must
 *                 have its workflow on disk.
 *   path-filters  every `workspace:*` dependency of an app is covered by the
 *                 ci.yml filter group gating that app's build job. `CI Success`
 *                 treats a skipped job as a pass, so an uncovered dependency
 *                 merges with its build never having run. And every path the
 *                 deploy treats as shared (`SHARED_PATHS` in
 *                 tools/deploy-surfaces.ts) is in ci.yml's `shared` group, so
 *                 a change that redeploys every surface was built for each.
 *   pinning       every `bunx`/`npx` tool with no manifest entry carries an
 *                 exact version: it runs in jobs holding deploy credentials.
 *                 zizmor's `unpinned-uses` covers action SHAs only.
 *   deploy-order  in `deploy-cloudflare.yml` (read through the local composite
 *                 actions its jobs use), the Convex push needs the job
 *                 refusing a deploy with no CONVEX_DEPLOY_KEY (a step whose
 *                 script names the key and can `exit 1`) and every build
 *                 job, every deploy job needs every build job and the push,
 *                 the smoke job needs every deploy job, and the deploy record
 *                 needs the smoke job to have SUCCEEDED.
 *                 A build job uploads an artifact built from source; a pass
 *                 that downloads one and re-uploads it is not a build, and
 *                 only what ships its output waits for it.
 *                 Every one of those jobs sits downstream of a job that is
 *                 skipped by design, so each must carry an explicit status
 *                 function in its `if:` — the implicit `success()` is false
 *                 whenever any ancestor was skipped.
 *   secrets-env   every job that reads an Environment secret declared in
 *                 `tools/environments.ts` (`production`: Cloudflare, Convex
 *                 and Discord; `preview`: Cloudflare and the staging Convex
 *                 key) declares an Environment holding it, and every
 *                 Environment a job names is declared there. The secrets live
 *                 only in Environments: `production` admits `main` alone, and
 *                 `preview` admits any branch, but only from a job that names
 *                 it, on a PR someone labelled `preview`. The nightly
 *                 repository-secret sentinel is the
 *                 one exemption, and it must stay outside every Environment.
 *                 zizmor's `secrets-outside-env` runs only under
 *                 `--persona=auditor`, which `lint-workflows.sh` does not use.
 *
 * Every check refuses to pass by absence: a parse that found no jobs, no
 * filter groups or no workflow files is a failure, not a clean result.
 *
 * Usage:
 *   bun tools/check-workflows.ts                       # all five
 *   bun tools/check-workflows.ts --only=deploy-order   # one (comma-separate for more)
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WorkflowFile, Yaml } from 'gates/lib/workflowYaml'
import {
  ancestorsOf,
  executable,
  expandedStepsOf,
  isObject,
  jobOf,
  needsOf,
  stepsOf,
} from 'gates/lib/workflowYaml'
import { readManifests } from 'gates/lib/workspaceGraph'
import { WORKERS } from './check-workers'
import { SHARED_PATHS } from './deploy-surfaces'
import type { EnvironmentSpec, RulesetSpec } from './environments'
import { ENVIRONMENTS, MAIN_RULESET, SECRET_SENTINEL } from './environments'

export type { WorkflowFile }

type Manifest = {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export type WorkflowContext = {
  /** Workflows AND composite actions, repo-relative paths. */
  files: WorkflowFile[]
  /** `package.json` path (repo-relative) -> manifest. Root is `package.json`. */
  manifests: Map<string, Manifest>
  /** Package name -> the bins bun.lock records for it. */
  lockBins: Map<string, string[]>
  exists: (repoRelPath: string) => boolean
}

export type CheckResult = { ok: string; failures: string[] }

export type WorkflowCheck = {
  id: string
  label: string
  run: (ctx: WorkflowContext) => CheckResult
}

// ─── shared helpers ─────────────────────────────────────────────────────────

const CI = '.github/workflows/ci.yml'
const DEPLOY = '.github/workflows/deploy-cloudflare.yml'

function file(ctx: WorkflowContext, path: string): Yaml | undefined {
  return ctx.files.find((f) => f.path === path)?.doc
}

const workflowsOnly = (ctx: WorkflowContext) =>
  ctx.files.filter((f) => f.path.startsWith('.github/workflows/'))

// ─── aggregator ─────────────────────────────────────────────────────────────

/**
 * The aggregate job's key — the required-status-check identity, not a fact
 * about the job graph. Renaming it means updating the `main` ruleset too.
 */
const AGGREGATOR = 'quality-checks'

/**
 * The workflow behind each gate the `main` ruleset (`MAIN_RULESET` in
 * tools/environments.ts) holds outside ci.yml: a required status context that
 * `needs:` cannot reach, or a code-scanning tool. Deleting the workflow while
 * the ruleset still waits on it leaves every PR waiting on a result that never
 * arrives.
 */
const GATE_WORKFLOWS: Record<string, string> = {
  'PR title is a conventional commit': '.github/workflows/pr-title.yml',
  CodeQL: '.github/workflows/codeql.yml',
}

/** Jobs deliberately left out of the gate, each with a reason. Empty, and the bar is high. */
const UNGATED_BY_DESIGN: Record<string, string> = {}

export function checkAggregator(
  ctx: WorkflowContext,
  exempt: Record<string, string> = UNGATED_BY_DESIGN,
  ruleset: RulesetSpec = MAIN_RULESET
): CheckResult {
  const doc = file(ctx, CI)
  if (!doc) return { ok: '', failures: [`${CI} is missing`] }
  const jobs = isObject(doc.jobs) ? Object.keys(doc.jobs) : []
  if (jobs.length === 0) return { ok: '', failures: [`${CI} has no jobs`] }
  if (!isObject(doc.jobs) || !jobs.includes(AGGREGATOR)) {
    return {
      ok: '',
      failures: [
        `${CI} has no \`${AGGREGATOR}\` job. If the aggregate gate was renamed, update ` +
          'AGGREGATOR here AND the `main` branch ruleset — they are the same fact.',
      ],
    }
  }
  const needs = new Set(needsOf(doc.jobs[AGGREGATOR]))
  if (needs.size === 0) {
    return {
      ok: '',
      failures: [`\`${AGGREGATOR}\` has an empty \`needs:\` — the required check gates nothing.`],
    }
  }
  const failures: string[] = []
  for (const job of jobs) {
    if (job === AGGREGATOR || needs.has(job) || job in exempt) continue
    failures.push(
      `job \`${job}\` is NOT in \`${AGGREGATOR}.needs\` — it can never fail the required check. ` +
        `Add it to ${CI} → ${AGGREGATOR} → needs.`
    )
  }
  for (const name of needs) {
    if (!jobs.includes(name))
      failures.push(`\`${AGGREGATOR}.needs\` lists \`${name}\`, which is not a job.`)
  }
  for (const job of Object.keys(exempt)) {
    if (needs.has(job))
      failures.push(`\`${job}\` is exempted as ungated but IS gated — drop the exemption.`)
  }
  const gate = doc.jobs[AGGREGATOR]
  const gateName = isObject(gate) && typeof gate.name === 'string' ? gate.name : AGGREGATOR
  if (!ruleset.requiredChecks.includes(gateName)) {
    failures.push(
      `the \`${ruleset.name}\` ruleset in tools/environments.ts does not require \`${gateName}\` — ` +
        'the aggregate gate would block nothing.'
    )
  }
  const others = [
    ...ruleset.requiredChecks.filter((c) => c !== gateName),
    ...ruleset.codeScanning.map((t) => t.tool),
  ]
  for (const other of others) {
    const workflow = GATE_WORKFLOWS[other]
    if (!workflow) {
      failures.push(
        `the \`${ruleset.name}\` ruleset waits on \`${other}\`, which no workflow is known to ` +
          'produce — add it to GATE_WORKFLOWS in tools/check-workflows.ts.'
      )
    } else if (!ctx.exists(workflow)) {
      failures.push(
        `${workflow} is missing, but the \`${ruleset.name}\` ruleset still waits on \`${other}\`. ` +
          'Restore it, or drop the gate from MAIN_RULESET in the change that removes it from the ruleset.'
      )
    }
  }
  return {
    ok: `\`${AGGREGATOR}\` gates all ${jobs.length - 1} jobs in ${CI} (the ruleset also waits on: ${others.join(', ')})`,
    failures,
  }
}

// ─── path-filters ───────────────────────────────────────────────────────────

/**
 * Which filter group gates each app's build job: `ciFilter` in WORKERS
 * (tools/check-workers.ts), the one list of apps. An app missing from both
 * this and NO_FILTER_GROUP is a hard failure.
 */
const APP_TO_FILTER: Record<string, string> = Object.fromEntries(
  WORKERS.map(({ app, ciFilter }) => [app, ciFilter])
)

/** Apps with no filter group, each with a reason and an exit condition. Empty. */
const NO_FILTER_GROUP: Record<string, string> = {}

/**
 * `SHARED_PATHS` entries ci.yml's `shared` group need not carry, each with a
 * reason. `packages/` is filtered per app: the dependency edges above.
 */
const SHARED_BY_APP = new Set(['packages/'])

/** A path that falls under a deploy `SHARED_PATHS` entry, to match ci.yml's globs against. */
const probeFor = (entry: string): string =>
  entry.endsWith('/') ? `${entry}x` : entry.replace(/\*$/, '.json')

/** The `dorny/paths-filter` groups in ci.yml's `changes` job, aliases expanded. */
function filterGroups(ci: Yaml): Map<string, string[]> {
  const jobs = isObject(ci.jobs) ? ci.jobs : {}
  for (const f of stepsOf({ path: CI, doc: { jobs } })) {
    const uses = f.step.uses
    const withs = f.step.with
    if (typeof uses !== 'string' || !uses.startsWith('dorny/paths-filter@')) continue
    if (!isObject(withs) || typeof withs.filters !== 'string') continue
    const parsed = Bun.YAML.parse(withs.filters)
    if (!isObject(parsed)) return new Map()
    return new Map(
      Object.entries(parsed).map(([group, patterns]) => [
        group,
        (Array.isArray(patterns) ? patterns.flat(Number.POSITIVE_INFINITY) : []).filter(
          (p): p is string => typeof p === 'string'
        ),
      ])
    )
  }
  return new Map()
}

/** Does a directory glob in `patterns` cover files under `dir`? */
function covers(patterns: readonly string[], dir: string): boolean {
  return patterns.some((pattern) => {
    const prefix = pattern.replace(/\/\*\*\/\*$/, '').replace(/\/\*\*$/, '')
    if (prefix === pattern) return false
    return prefix === dir || dir.startsWith(`${prefix}/`)
  })
}

export function checkPathFilters(ctx: WorkflowContext): CheckResult {
  const ci = file(ctx, CI)
  if (!ci) return { ok: '', failures: [`${CI} is missing`] }
  const groups = filterGroups(ci)
  const failures: string[] = []
  if (groups.size < 4) {
    failures.push(
      `parsed ${groups.size} filter group(s) from ${CI}; expected at least 4 — the block moved.`
    )
  }

  const workspaceDirs = new Map<string, string>()
  for (const [path, manifest] of ctx.manifests) {
    const dir = path.replace(/\/package\.json$/, '')
    if (manifest.name && dir !== 'package.json') workspaceDirs.set(manifest.name, dir)
  }
  const apps = [...ctx.manifests.keys()]
    .map((p) => p.match(/^apps\/([^/]+)\/package\.json$/)?.[1])
    .filter((a): a is string => a !== undefined)
    .sort()
  if (apps.length < 3) failures.push(`found ${apps.length} app(s); expected at least 3.`)

  let edges = 0
  for (const app of apps) {
    const group = APP_TO_FILTER[app]
    if (!group) {
      if (!(app in NO_FILTER_GROUP)) {
        failures.push(`apps/${app} has no filter group in APP_TO_FILTER and no stated exemption.`)
      }
      continue
    }
    const patterns = groups.get(group)
    if (!patterns) {
      failures.push(`apps/${app} maps to filter group \`${group}\`, which ${CI} does not define.`)
      continue
    }
    const manifest = ctx.manifests.get(`apps/${app}/package.json`) ?? {}
    for (const [name, range] of Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    })) {
      if (!range.startsWith('workspace:')) continue
      const dir = workspaceDirs.get(name)
      if (!dir) {
        failures.push(`apps/${app} depends on workspace \`${name}\`, which no workspace declares.`)
        continue
      }
      edges++
      if (!covers(patterns, dir)) {
        failures.push(
          `apps/${app} depends on \`${name}\` (${dir}) but filter group \`${group}\` does not ` +
            `cover it — a change there would skip the build while CI reports green. Add ` +
            `'${dir}/**' to \`${group}\` (or to the \`shared\` anchor) in ${CI}.`
        )
      }
    }
  }
  if (edges < 5 && apps.length >= 3) {
    failures.push(`checked ${edges} workspace dependency edge(s); expected at least 5.`)
  }

  const shared = groups.get('shared') ?? []
  if (shared.length === 0) failures.push(`${CI} has no \`shared\` filter group.`)
  const sharedPaths = shared.map((p) => new Bun.Glob(p))
  const deployShared = sharedPaths.length
    ? SHARED_PATHS.filter((entry) => !SHARED_BY_APP.has(entry))
    : []
  for (const entry of deployShared) {
    const probe = probeFor(entry)
    if (!sharedPaths.some((glob) => glob.match(probe))) {
      failures.push(
        `tools/deploy-surfaces.ts ships every surface on a change to \`${entry}\`, but ${CI}'s ` +
          `\`shared\` group does not cover it (\`${probe}\`) — such a change could deploy an app ` +
          'whose build CI skipped. Add it to `shared`, or drop it from SHARED_PATHS.'
      )
    }
  }
  return {
    ok:
      `${edges} workspace dependency edge(s) across ${apps.length} app(s) covered by their ` +
      `filter groups; ${deployShared.length} deploy-shared path(s) in \`shared\``,
    failures,
  }
}

// ─── pinning ────────────────────────────────────────────────────────────────

/**
 * Tools `bunx` resolves from the lockfile: EXACT dependency names of every
 * manifest, and the bins bun.lock records for them (`bunx playwright` runs
 * `@playwright/test`'s bin). Not the unscoped half of scoped names — that once
 * exempted `auth`, `core`, `test` and 22 other real npm packages nobody had
 * declared.
 */
function locallyResolved(ctx: WorkflowContext): Set<string> {
  const names = new Set<string>()
  for (const pkg of ctx.manifests.values()) {
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
      names.add(name)
      for (const bin of ctx.lockBins.get(name) ?? []) names.add(bin)
    }
  }
  return names
}

/** `bunx tool`, `npx tool` and `bun x tool` calls in one script. */
export function runnerCalls(script: string): { runner: string; tool: string }[] {
  const out: { runner: string; tool: string }[] = []
  for (const line of executable(script).split('\n')) {
    for (const m of line.matchAll(/\b(bunx|npx|bun\s+x)\s+(?:--[\w-]+\s+)*([@\w./-]+)/g)) {
      if (m[1] && m[2]) out.push({ runner: m[1].replace(/\s+/, ' '), tool: m[2] })
    }
  }
  return out
}

/** `tool@4.108.0` is pinned; `tool`, `tool@latest` and `tool@4` are not. */
export function toolIsPinned(tool: string): boolean {
  const at = tool.lastIndexOf('@')
  return at > 0 && /^\d+\.\d+\.\d+/.test(tool.slice(at + 1))
}

const toolName = (tool: string) => {
  const at = tool.lastIndexOf('@')
  return at > 0 ? tool.slice(0, at) : tool
}

/** Every string a step can execute: `run`, and every `with:` input. */
function executableStrings(step: Yaml): string[] {
  const out: string[] = []
  if (typeof step.run === 'string') out.push(step.run)
  if (isObject(step.with)) {
    for (const v of Object.values(step.with)) if (typeof v === 'string') out.push(v)
  }
  return out
}

export function checkPinning(ctx: WorkflowContext): CheckResult {
  const failures: string[] = []
  const local = locallyResolved(ctx)
  let tools = 0
  if (ctx.files.length < 5) {
    failures.push(`only ${ctx.files.length} workflow file(s) scanned — expected at least 5.`)
  }
  for (const f of ctx.files) {
    for (const { where, step } of stepsOf(f)) {
      for (const script of executableStrings(step)) {
        for (const { runner, tool } of runnerCalls(script)) {
          if (local.has(toolName(tool))) continue
          tools++
          if (!toolIsPinned(tool)) {
            failures.push(
              `${f.path} ${where}: \`${runner} ${tool}\` has no manifest entry and no exact ` +
                'version — it resolves whatever npm published last. Write `tool@X.Y.Z`, or add ' +
                'the tool to a manifest so the lockfile pins it.'
            )
          }
        }
      }
    }
  }
  return {
    ok: `${tools} one-off runner call(s) version-pinned across ${ctx.files.length} file(s)`,
    failures,
  }
}

// ─── deploy-order ───────────────────────────────────────────────────────────

const SMOKE_SCRIPT = 'tools/smoke-production.sh'

/**
 * The step that fails a deploy with no CONVEX_DEPLOY_KEY, found by name; its
 * script must name the key and `exit 1`.
 */
export const GUARD_STEP = 'Refuse to deploy without a Convex deploy key'

/** A status-check function other than the implicit `success()`. */
const EXPLICIT_STATUS = /\b(?:always|cancelled|failure)\(\)/

/**
 * The deploy workflow's job graph keeps its orderings:
 *
 *   1. the job that pushes the Convex backend (`convex deploy`) needs the job
 *      carrying the `GUARD_STEP`, whose script names CONVEX_DEPLOY_KEY and can
 *      `exit 1` — without it, production ran a four-day-stale
 *      backend in 2026-08 with nothing red — and every build job (one that
 *      uploads an artifact and downloads none), so a failed build of ANY
 *      surface stops the push, rather than leaving a new backend under the old
 *      client until the next green run;
 *   2. every job that ships (`bun run deploy`) needs every build job and the
 *      push — all builds finish, and the backend is pushed, before any
 *      traffic moves;
 *   3. the job that runs the smoke list needs every job that ships;
 *   4. the job holding `contents: write` (the deploy record) needs the smoke
 *      job and requires `needs.<smoke>.result == 'success'` — the record moves
 *      only once what shipped has answered;
 *   5. a job that downloads an artifact needs every job that uploads it — a
 *      deploy cannot race the post-build pass whose output it ships.
 *
 * And every job from the push onwards whose ancestors include a job with its
 * own `if:` (other than the root gate) carries an explicit status function.
 * A bare `if:` is prefixed with `success()`, which at job level is false when
 * ANY ancestor was skipped — so a record behind a skipped per-surface job
 * stopped moving on every partial deploy, and an out-of-order CI run then
 * shipped an older tree over a newer one with every job green.
 *
 * Each is one missing `needs:` entry or status function away from silently
 * breaking, and nothing else would notice until a partial deploy was recorded
 * as whole.
 */
export function checkDeployOrder(ctx: WorkflowContext): CheckResult {
  const doc = file(ctx, DEPLOY)
  if (!doc) return { ok: '', failures: [`${DEPLOY} is missing`] }
  const jobs = isObject(doc.jobs) ? doc.jobs : {}
  const steps = expandedStepsOf(ctx.files, { path: DEPLOY, doc })
  const runs = (step: Yaml) => (typeof step.run === 'string' ? executable(step.run) : '')
  const jobsWhere = (pred: (step: Yaml) => boolean) =>
    [...new Set(steps.filter(({ step }) => pred(step)).map(({ where }) => jobOf(where)))].sort()

  const uses = (step: Yaml, action: string) =>
    typeof step.uses === 'string' && step.uses.startsWith(`actions/${action}@`)
  const downloaders = new Set(jobsWhere((step) => uses(step, 'download-artifact')))
  const builders = jobsWhere((step) => uses(step, 'upload-artifact')).filter(
    (job) => !downloaders.has(job)
  )
  const guards = jobsWhere((step) => step.name === GUARD_STEP)
  const pushers = jobsWhere((step) => runs(step).includes('convex deploy'))
  const shippers = jobsWhere((step) => /\bbun run deploy\b/.test(runs(step)))
  const smokers = jobsWhere((step) => runs(step).includes(SMOKE_SCRIPT))
  const recorders = Object.keys(jobs)
    .filter((id) => {
      const job = jobs[id]
      return isObject(job) && isObject(job.permissions) && job.permissions.contents === 'write'
    })
    .sort()

  const failures: string[] = []
  if (builders.length === 0)
    failures.push(`${DEPLOY} has no job that builds an artifact from source.`)
  if (guards.length === 0) failures.push(`${DEPLOY} has no \`${GUARD_STEP}\` step.`)
  for (const { step } of steps.filter(({ step }) => step.name === GUARD_STEP)) {
    const script = runs(step)
    if (!script.includes('CONVEX_DEPLOY_KEY') || !script.includes('exit 1'))
      failures.push(
        `${DEPLOY} \`${GUARD_STEP}\` no longer fails when CONVEX_DEPLOY_KEY is absent — an ` +
          'absent key would ship a current client against a stale backend with nothing red.'
      )
  }
  if (pushers.length === 0) failures.push(`${DEPLOY} has no job that runs \`convex deploy\`.`)
  if (shippers.length === 0) failures.push(`${DEPLOY} has no job that runs \`bun run deploy\`.`)
  if (smokers.length === 0) failures.push(`${DEPLOY} has no job that runs ${SMOKE_SCRIPT}.`)
  if (recorders.length === 0)
    failures.push(`${DEPLOY} has no job with \`contents: write\` to move the deploy record.`)

  const requireBefore = (later: string[], earlier: string[], why: string) => {
    for (const job of later) {
      const ancestors = ancestorsOf(jobs, job)
      for (const dep of earlier) {
        if (dep !== job && !ancestors.has(dep))
          failures.push(`${DEPLOY} job \`${job}\` does not need \`${dep}\` — ${why}`)
      }
    }
  }
  requireBefore(pushers, guards, 'the deploy-key guard must pass before the backend is pushed.')
  requireBefore(pushers, builders, 'every build must finish before the backend is pushed.')
  requireBefore(shippers, builders, 'every build must finish before any surface ships.')
  requireBefore(shippers, pushers, 'the backend must be pushed before any surface ships.')
  requireBefore(smokers, shippers, 'the smoke list must run after every deploy.')
  requireBefore(recorders, smokers, 'the deploy record must move only after the smoke list passed.')

  const artifact = (step: Yaml) =>
    isObject(step.with) && typeof step.with.name === 'string' ? step.with.name : ''
  for (const { where, step } of steps.filter(({ step }) => uses(step, 'download-artifact'))) {
    const name = artifact(step)
    const producers = jobsWhere((s) => uses(s, 'upload-artifact') && artifact(s) === name)
    if (producers.length === 0)
      failures.push(`${DEPLOY} ${where} downloads \`${name}\`, which no job uploads.`)
    requireBefore([jobOf(where)], producers, `it downloads \`${name}\`, which that job uploads.`)
  }

  const ifOf = (id: string): string => {
    const job = jobs[id]
    return isObject(job) && typeof job.if === 'string' ? job.if : ''
  }
  const gated = [...new Set([...pushers, ...shippers, ...smokers, ...recorders])].sort()
  for (const job of gated) {
    const skippable = [...ancestorsOf(jobs, job)]
      .filter((a) => needsOf(jobs[a]).length > 0 && ifOf(a) !== '')
      .sort()
    if (skippable.length > 0 && !EXPLICIT_STATUS.test(ifOf(job))) {
      failures.push(
        `${DEPLOY} job \`${job}\` has no explicit status function (e.g. \`!cancelled() && ` +
          `!failure()\`) in its \`if:\`, but depends on \`${skippable.join('`, `')}\`, which can be ` +
          'skipped — the implicit `success()` would then skip it too.'
      )
    }
  }
  for (const job of recorders) {
    for (const smoke of smokers) {
      if (!ifOf(job).replace(/\s+/g, ' ').includes(`needs.${smoke}.result == 'success'`)) {
        failures.push(
          `${DEPLOY} job \`${job}\` does not require \`needs.${smoke}.result == 'success'\` — ` +
            'the deploy record must move only when the smoke list actually ran and passed.'
        )
      }
    }
  }
  return {
    ok:
      `${builders.length} build job(s), then ${pushers.join(', ') || 'no push'}, before ` +
      `${shippers.length} deploy job(s), then ` +
      `${smokers.join(', ')}, then ${recorders.join(', ')}`,
    failures,
  }
}

// ─── secrets-env ────────────────────────────────────────────────────────────

export type SecretsDeclaration = {
  environments: readonly EnvironmentSpec[]
  /** The one job that maps Environment secrets with NO environment; null skips it (tests). */
  sentinel: { file: string; job: string } | null
}

const DECLARED: SecretsDeclaration = { environments: ENVIRONMENTS, sentinel: SECRET_SENTINEL }

/** `environment: production` and `environment: { name: production }` both count. */
function environmentOf(job: Yaml): string | undefined {
  const env = job.environment
  if (typeof env === 'string') return env
  return isObject(env) && typeof env.name === 'string' ? env.name : undefined
}

/**
 * Every job that reads an Environment secret declares that Environment, and
 * every Environment a job names is declared in `tools/environments.ts`.
 *
 * Each Environment admits only its declared branches, and its secrets are
 * stored there rather than at repository level. A job outside it cannot read
 * them, so an edited copy of a workflow dispatched from a branch never holds a
 * production credential — and a job that forgets the declaration reads an empty
 * string on `main` too, which this names before a deploy finds it. That the
 * live settings match the declaration is `tools/environments.ts`, run nightly.
 *
 * One job is exempt and must stay outside every Environment: the nightly
 * sentinel maps the secrets with no Environment so that any value it can read
 * proves a repository-level copy exists.
 */
export function checkSecretsEnv(
  ctx: WorkflowContext,
  decl: SecretsDeclaration = DECLARED
): CheckResult {
  const failures: string[] = []
  const workflows = new Set<string>()
  // A name may live in more than one Environment (the Cloudflare token is in
  // `production` and `preview`); a job inside any of them may read it.
  const owner = new Map<string, string[]>()
  for (const e of decl.environments) {
    for (const s of e.secrets) owner.set(s, [...(owner.get(s) ?? []), e.name])
  }
  const declaredEnvs = new Set(decl.environments.map((e) => e.name))
  const secretRef = new RegExp(`\\$\\{\\{\\s*secrets\\.(${[...owner.keys()].join('|')})\\b`, 'g')
  let readers = 0
  let sentinelSeen = false
  for (const f of workflowsOnly(ctx)) {
    const jobs = isObject(f.doc.jobs) ? f.doc.jobs : {}
    for (const [id, job] of Object.entries(jobs)) {
      if (!isObject(job)) continue
      const env = environmentOf(job)
      if (env !== undefined && !declaredEnvs.has(env)) {
        failures.push(
          `${f.path} job \`${id}\` names environment \`${env}\`, which tools/environments.ts does not ` +
            'declare — declare it there (branches and secrets), then `bun tools/environments.ts --apply`.'
        )
      }
      const names = owner.size
        ? [...new Set([...JSON.stringify(job).matchAll(secretRef)].map((m) => m[1] as string))]
        : []
      if (decl.sentinel && f.path === decl.sentinel.file && id === decl.sentinel.job) {
        sentinelSeen = true
        const missing = [...owner.keys()].filter((s) => !names.includes(s))
        if (env !== undefined) {
          failures.push(
            `${f.path} job \`${id}\` is the repository-secret sentinel and must declare no environment — ` +
              'inside one it reads the Environment copy and proves nothing.'
          )
        }
        if (missing.length) {
          failures.push(
            `${f.path} job \`${id}\` (the sentinel) does not map secrets.${missing.join(', secrets.')} — ` +
              'a repository-level copy of those would go unnoticed.'
          )
        }
        continue
      }
      if (names.length === 0) continue
      readers++
      workflows.add(f.path)
      for (const name of names) {
        const want = owner.get(name) ?? []
        if (env !== undefined && want.includes(env)) continue
        const admits = want
          .map((w) => `${w} (${decl.environments.find((e) => e.name === w)?.branches.join(', ')})`)
          .join(' or ')
        failures.push(
          `${f.path} job \`${id}\` reads secrets.${name} without \`environment: ${want.join('` or `')}\` — ` +
            `the secret lives only in ${admits}. Add the Environment under its \`runs-on:\`.`
        )
      }
    }
  }
  if (readers === 0) {
    failures.push(
      `no job reads ${[...owner.keys()].join(', ') || 'a declared Environment secret'} — this would pass by ` +
        'doing nothing. If the secrets were renamed, update tools/environments.ts.'
    )
  }
  if (decl.sentinel && !sentinelSeen) {
    failures.push(
      `the repository-secret sentinel (${decl.sentinel.file} job \`${decl.sentinel.job}\`) is missing — ` +
        'restore it or update SECRET_SENTINEL in tools/environments.ts.'
    )
  }
  return {
    ok:
      `${readers} job(s) in ${workflows.size} workflow(s) read an Environment secret inside its ` +
      `declared Environment${decl.sentinel ? '; the sentinel stays outside' : ''}`,
    failures,
  }
}

// ─── runner ─────────────────────────────────────────────────────────────────

export const WORKFLOW_CHECKS: readonly WorkflowCheck[] = [
  { id: 'aggregator', label: 'CI aggregate gate', run: (ctx) => checkAggregator(ctx) },
  { id: 'path-filters', label: 'path filters', run: checkPathFilters },
  { id: 'pinning', label: 'runner pinning', run: checkPinning },
  { id: 'deploy-order', label: 'deploy job order', run: checkDeployOrder },
  { id: 'secrets-env', label: 'Environment secrets', run: (ctx) => checkSecretsEnv(ctx) },
]

/** Read the real repo into a context. */
export function loadContext(root: string): WorkflowContext {
  const files: WorkflowFile[] = []
  const parse = (path: string) => {
    const doc = Bun.YAML.parse(readFileSync(join(root, path), 'utf8'))
    files.push({ path, doc: isObject(doc) ? doc : {} })
  }
  const wfDir = join(root, '.github/workflows')
  if (existsSync(wfDir)) {
    for (const name of readdirSync(wfDir).sort()) {
      if (/\.ya?ml$/.test(name)) parse(`.github/workflows/${name}`)
    }
  }
  const actionsDir = join(root, '.github/actions')
  if (existsSync(actionsDir)) {
    for (const entry of readdirSync(actionsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      for (const name of ['action.yml', 'action.yaml']) {
        if (existsSync(join(actionsDir, entry.name, name)))
          parse(`.github/actions/${entry.name}/${name}`)
      }
    }
  }
  const manifests = new Map<string, Manifest>()
  const readManifest = (path: string) => {
    if (existsSync(join(root, path))) {
      manifests.set(path, JSON.parse(readFileSync(join(root, path), 'utf8')) as Manifest)
    }
  }
  // The root and every apps/packages workspace, but NOT tools: its deps must
  // not widen what a `bunx` call may resolve locally.
  readManifest('package.json')
  for (const { dir, manifest } of readManifests(root)) {
    manifests.set(`${dir}/package.json`, manifest as Manifest)
  }
  // A top-level `packages` key is the package's own name; nested keys
  // (`parent/child`) are the copies one dependent resolved differently.
  const lockBins = new Map<string, string[]>()
  const lockPath = join(root, 'bun.lock')
  if (existsSync(lockPath)) {
    const lock = Bun.JSONC.parse(readFileSync(lockPath, 'utf8')) as {
      packages?: Record<string, [string, string, { bin?: Record<string, string> }?]>
    }
    for (const [key, [spec, , meta]] of Object.entries(lock.packages ?? {})) {
      if (spec.slice(0, spec.lastIndexOf('@')) === key && meta?.bin)
        lockBins.set(key, Object.keys(meta.bin))
    }
  }
  return {
    files,
    manifests,
    lockBins,
    exists: (path) => existsSync(join(root, path)),
  }
}

export function main(argv: string[], load = () => loadContext(join(import.meta.dir, '..'))) {
  const only = argv
    .find((a) => a.startsWith('--only='))
    ?.slice('--only='.length)
    .split(',')
  const unknown = (only ?? []).filter((id) => !WORKFLOW_CHECKS.some((c) => c.id === id))
  if (unknown.length > 0) {
    console.error(
      `✗ unknown check(s): ${unknown.join(', ')}. Known: ${WORKFLOW_CHECKS.map((c) => c.id).join(', ')}`
    )
    return 2
  }
  const ctx = load()
  let failed = false
  for (const check of WORKFLOW_CHECKS) {
    if (only && !only.includes(check.id)) continue
    const { ok, failures } = check.run(ctx)
    if (failures.length === 0) {
      console.log(`✓ ${check.label}: ${ok}`)
      continue
    }
    failed = true
    console.error(`✗ ${check.label}:`)
    for (const f of failures) console.error(`    • ${f}`)
  }
  return failed ? 1 : 0
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
