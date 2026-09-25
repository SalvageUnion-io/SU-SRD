#!/usr/bin/env bun
/**
 * Workflow invariants — `bun run check workflows`.
 *
 * Five properties of `.github/`, checked from one parse of every workflow and
 * composite action. They used to be five scripts, and two of them carried a
 * hand-written YAML state machine "because there is no parser in this repo" —
 * while `Bun.YAML.parse` shipped in the runtime that ran them. Each of those
 * parsers was a few hundred lines that could be fooled by a `run: |` body
 * shaped like YAML; a real parse cannot be.
 *
 *   aggregator    `CI Success` (`quality-checks` in ci.yml) `needs:` every job
 *                 in ci.yml. It is the one required status check, and it can
 *                 only fail on a job it needs — a job missing from that list
 *                 still runs, still goes red, and cannot block a merge.
 *   path-filters  every `workspace:*` dependency of an app is covered by the
 *                 ci.yml filter group gating that app's build job. `CI Success`
 *                 treats a skipped job as a pass, so an uncovered dependency
 *                 merges with its build never having run (the #731 shape).
 *   pinning       every third-party action is pinned to a full commit SHA, and
 *                 every `bunx`/`npx` tool with no manifest entry carries an
 *                 exact version. A tag is a mutable pointer, and these run in
 *                 jobs holding deploy credentials.
 *   bun-version   `.bun-version` is the one Bun: the root `bun-types` matches
 *                 it, no workflow pins Bun by hand instead of using
 *                 `./.github/actions/setup-bun`, and the Bun running this is
 *                 the pinned one (a mismatched Bun cannot read bun.lock, and
 *                 `bun why` exits 0 while saying so).
 *   convex-guard  `deploy-cloudflare.yml` still runs `convex deploy` and still
 *                 fails a production deploy with no CONVEX_DEPLOY_KEY. Without
 *                 it, production ran a four-day-stale backend in 2026-08 with
 *                 nothing red. The LIVE half — what the deployment actually
 *                 serves — is `tools/check-convex-parity.ts`, run nightly.
 *
 * Every check refuses to pass by absence: a parse that found no jobs, no
 * filter groups or no workflow files is a failure, not a clean result.
 *
 * Usage:
 *   bun tools/check-workflows.ts                     # all five
 *   bun tools/check-workflows.ts --only=pinning      # one (comma-separate for more)
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type Yaml = Record<string, unknown>

export type WorkflowFile = { path: string; doc: Yaml }

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
  /** Contents of `.bun-version`. */
  bunVersion: string
  /** The Bun running this, or null to skip that comparison (tests). */
  runningBun: string | null
  exists: (repoRelPath: string) => boolean
}

export type CheckResult = { ok: string; failures: string[] }

export type WorkflowCheck = {
  id: string
  label: string
  run: (ctx: WorkflowContext) => CheckResult
}

// ─── shared helpers ─────────────────────────────────────────────────────────

const isObject = (v: unknown): v is Yaml => typeof v === 'object' && v !== null && !Array.isArray(v)

const CI = '.github/workflows/ci.yml'
const DEPLOY = '.github/workflows/deploy-cloudflare.yml'

function file(ctx: WorkflowContext, path: string): Yaml | undefined {
  return ctx.files.find((f) => f.path === path)?.doc
}

const workflowsOnly = (ctx: WorkflowContext) =>
  ctx.files.filter((f) => f.path.startsWith('.github/workflows/'))

type Step = { where: string; step: Yaml }

/** Every step in a workflow's jobs, or a composite action's `runs.steps`. */
export function stepsOf(f: WorkflowFile): Step[] {
  const out: Step[] = []
  const jobs = isObject(f.doc.jobs) ? f.doc.jobs : {}
  for (const [job, def] of Object.entries(jobs)) {
    if (!isObject(def) || !Array.isArray(def.steps)) continue
    def.steps.forEach((step, i) => {
      if (isObject(step)) out.push({ where: `jobs.${job}.steps[${i}]`, step })
    })
  }
  const runs = isObject(f.doc.runs) ? f.doc.runs : undefined
  if (runs && Array.isArray(runs.steps)) {
    runs.steps.forEach((step, i) => {
      if (isObject(step)) out.push({ where: `runs.steps[${i}]`, step })
    })
  }
  return out
}

/** Shell text with comment lines removed — prose about a command is not the command. */
const executable = (script: string): string =>
  script
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')

// ─── aggregator ─────────────────────────────────────────────────────────────

/**
 * The aggregate job's key — the required-status-check identity, not a fact
 * about the job graph. Renaming it means updating the `main` ruleset too.
 */
export const AGGREGATOR = 'quality-checks'

/**
 * Required status contexts in OTHER workflows, which `needs:` cannot reach.
 * Their workflow files must exist: deleting one while its context is still
 * required leaves every PR waiting on a check that never arrives.
 */
const SEPARATELY_REQUIRED = [
  { context: 'Analyze (javascript-typescript)', workflow: '.github/workflows/codeql.yml' },
] as const

/** Jobs deliberately left out of the gate, each with a reason. Empty, and the bar is high. */
const UNGATED_BY_DESIGN: Record<string, string> = {}

function needsOf(job: unknown): string[] {
  if (!isObject(job)) return []
  const needs = job.needs
  if (typeof needs === 'string') return [needs]
  return Array.isArray(needs) ? needs.filter((n): n is string => typeof n === 'string') : []
}

export function checkAggregator(
  ctx: WorkflowContext,
  exempt: Record<string, string> = UNGATED_BY_DESIGN
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
  for (const { context, workflow } of SEPARATELY_REQUIRED) {
    if (!ctx.exists(workflow)) {
      failures.push(
        `${workflow} is missing, but \`${context}\` is still treated as a required status ` +
          'context. Restore it, or drop it from SEPARATELY_REQUIRED in the change that removes it ' +
          'from the ruleset.'
      )
    }
  }
  const others = SEPARATELY_REQUIRED.map((r) => r.context).join(', ')
  return {
    ok: `\`${AGGREGATOR}\` gates all ${jobs.length - 1} jobs in ${CI} (also required separately: ${others})`,
    failures,
  }
}

// ─── path-filters ───────────────────────────────────────────────────────────

/**
 * Which filter group gates each app's build job. A genuine translation
 * (`apps/srd` is gated by `web`), so it cannot be derived; an app missing from
 * both this and NO_FILTER_GROUP is a hard failure.
 */
const APP_TO_FILTER: Record<string, string> = {
  itun: 'itun',
  srd: 'web',
  'discord-bot': 'bot',
  'su-assets': 'assets',
}

/** Apps with no filter group, each with a reason and an exit condition. Empty. */
const NO_FILTER_GROUP: Record<string, string> = {}

/** The `dorny/paths-filter` groups in ci.yml's `changes` job, aliases expanded. */
export function filterGroups(ci: Yaml): Map<string, string[]> {
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
  return {
    ok: `${edges} workspace dependency edge(s) across ${apps.length} app(s) covered by their filter groups`,
    failures,
  }
}

// ─── pinning ────────────────────────────────────────────────────────────────

/** Published by GitHub itself; a mutable tag here is not a third-party risk. */
const FIRST_PARTY_OWNERS = new Set(['actions', 'github'])
const SHA_PIN = /^[0-9a-f]{40}$/

export function isThirdParty(ref: string): boolean {
  if (ref.startsWith('./') || ref.startsWith('docker://')) return false
  return !FIRST_PARTY_OWNERS.has(ref.split('/')[0] ?? '')
}

/**
 * Tools `bunx` resolves from the lockfile: EXACT dependency names of every
 * manifest. Not the unscoped half of scoped names — that once exempted `auth`,
 * `core`, `test` and 22 other real npm packages nobody had declared.
 */
function locallyResolved(ctx: WorkflowContext): Set<string> {
  const names = new Set<string>()
  for (const pkg of ctx.manifests.values()) {
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) names.add(name)
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
  let actions = 0
  let tools = 0
  if (ctx.files.length < 5) {
    failures.push(`only ${ctx.files.length} workflow file(s) scanned — expected at least 5.`)
  }
  for (const f of ctx.files) {
    const refs: { where: string; ref: string }[] = []
    // A job-level `uses:` calls a reusable workflow — the same supply chain.
    for (const [job, def] of Object.entries(isObject(f.doc.jobs) ? f.doc.jobs : {})) {
      if (isObject(def) && typeof def.uses === 'string')
        refs.push({ where: `jobs.${job}`, ref: def.uses })
    }
    for (const { where, step } of stepsOf(f)) {
      if (typeof step.uses === 'string') refs.push({ where, ref: step.uses })
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
    for (const { where, ref } of refs) {
      if (!isThirdParty(ref)) continue
      actions++
      const pin = ref.lastIndexOf('@') === -1 ? '' : ref.slice(ref.lastIndexOf('@') + 1)
      if (!SHA_PIN.test(pin)) {
        failures.push(
          `${f.path} ${where}: \`${ref}\` is not pinned to a full commit SHA. Resolve the tag with ` +
            "`gh api repos/<owner>/<repo>/git/ref/tags/<tag> --jq '.object.sha'` and write " +
            '`<owner>/<repo>@<sha> # <version>`.'
        )
      }
    }
  }
  return {
    ok:
      `${actions} third-party action reference(s) SHA-pinned and ${tools} one-off runner ` +
      `call(s) version-pinned across ${ctx.files.length} file(s)`,
    failures,
  }
}

// ─── bun-version ────────────────────────────────────────────────────────────

const SETUP_BUN = './.github/actions/setup-bun'

/** Every literal `bun-version:` input (not `bun-version-file:`) in a step. */
function inlineBunPins(f: WorkflowFile): { where: string; version: string }[] {
  const out: { where: string; version: string }[] = []
  for (const { where, step } of stepsOf(f)) {
    if (!isObject(step.with)) continue
    const v = step.with['bun-version']
    if (typeof v === 'string' || typeof v === 'number') out.push({ where, version: String(v) })
  }
  return out
}

export function checkBunVersion(ctx: WorkflowContext): CheckResult {
  const failures: string[] = []
  const expected = ctx.bunVersion
  if (ctx.runningBun !== null && ctx.runningBun !== expected) {
    failures.push(
      `the running Bun is ${ctx.runningBun}, but .bun-version pins ${expected}. Install the ` +
        'pinned version — a mismatched Bun can fail to read bun.lock entirely, and ' +
        '`bun why` / `bun pm ls` exit 0 when it does.'
    )
  }
  const bunTypes = ctx.manifests.get('package.json')?.devDependencies?.['bun-types']
  if (!bunTypes) failures.push('root package.json declares no bun-types')
  else if (bunTypes.replace(/^[^0-9]*/, '') !== expected) {
    failures.push(`root bun-types = ${bunTypes}, expected ${expected}`)
  }
  const workflows = workflowsOnly(ctx)
  if (workflows.length === 0)
    failures.push('no workflow files found — this would pass by doing nothing')
  let composite = 0
  for (const f of workflows) {
    if (stepsOf(f).some(({ step }) => step.uses === SETUP_BUN)) composite++
    for (const { where, version } of inlineBunPins(f)) {
      failures.push(
        `${f.path} ${where} pins bun-version ${version} by hand` +
          (version === expected ? ' (it matches today, but will not track .bun-version)' : '') +
          ` — use ${SETUP_BUN}, which reads .bun-version.`
      )
    }
  }
  return {
    ok: `Bun ${expected}: bun-types matches, ${composite}/${workflows.length} workflow(s) use ${SETUP_BUN}, none pin by hand`,
    failures,
  }
}

// ─── convex-guard ───────────────────────────────────────────────────────────

export const GUARD_STEP = 'Refuse to deploy without a Convex deploy key'

export function checkConvexGuard(ctx: WorkflowContext): CheckResult {
  const doc = file(ctx, DEPLOY)
  if (!doc) {
    return {
      ok: '',
      failures: [
        `${DEPLOY} is missing, so nothing carries the Convex deploy guard — a production deploy ` +
          'could ship a client against a backend nobody pushed.',
      ],
    }
  }
  const failures: string[] = []
  const steps = stepsOf({ path: DEPLOY, doc })
  const runs = (step: Yaml) => (typeof step.run === 'string' ? executable(step.run) : '')
  if (!steps.some(({ step }) => runs(step).includes('convex deploy'))) {
    failures.push(
      `${DEPLOY} no longer runs \`convex deploy\`, so a deploy never pushes the backend.`
    )
  }
  // Asserted BY NAME: a file-wide search for `exit 1` and the key name was
  // once satisfied by the neighbouring Cloudflare-token guard and the build
  // step's env block, with this step deleted entirely.
  const guard = steps.find(({ step }) => step.name === GUARD_STEP)
  if (!guard) {
    failures.push(`${DEPLOY} has no \`${GUARD_STEP}\` step.`)
  } else {
    const script = runs(guard.step)
    if (!script.includes('CONVEX_DEPLOY_KEY') || !script.includes('exit 1')) {
      failures.push(
        `${DEPLOY} \`${GUARD_STEP}\` no longer fails when CONVEX_DEPLOY_KEY is absent — an ` +
          'absent key would ship a current client against a stale backend with nothing red.'
      )
    }
  }
  return {
    ok: 'a production deploy runs `convex deploy` and fails with no CONVEX_DEPLOY_KEY',
    failures,
  }
}

// ─── runner ─────────────────────────────────────────────────────────────────

export const WORKFLOW_CHECKS: readonly WorkflowCheck[] = [
  { id: 'aggregator', label: 'CI aggregate gate', run: (ctx) => checkAggregator(ctx) },
  { id: 'path-filters', label: 'path filters', run: checkPathFilters },
  { id: 'pinning', label: 'supply-chain pinning', run: checkPinning },
  { id: 'bun-version', label: 'Bun version', run: checkBunVersion },
  { id: 'convex-guard', label: 'Convex deploy guard', run: checkConvexGuard },
]

/** Read the real repo into a context. */
export function loadContext(root: string, runningBun: string | null): WorkflowContext {
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
  readManifest('package.json')
  for (const group of ['apps', 'packages']) {
    const base = join(root, group)
    if (!existsSync(base)) continue
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory()) readManifest(`${group}/${entry.name}/package.json`)
    }
  }
  const versionFile = join(root, '.bun-version')
  return {
    files,
    manifests,
    bunVersion: existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : '(missing)',
    runningBun,
    exists: (path) => existsSync(join(root, path)),
  }
}

function main(argv: readonly string[]): void {
  const only = argv
    .find((a) => a.startsWith('--only='))
    ?.slice('--only='.length)
    .split(',')
  const unknown = (only ?? []).filter((id) => !WORKFLOW_CHECKS.some((c) => c.id === id))
  if (unknown.length > 0) {
    console.error(
      `✗ unknown check(s): ${unknown.join(', ')}. Known: ${WORKFLOW_CHECKS.map((c) => c.id).join(', ')}`
    )
    process.exit(2)
  }
  const ctx = loadContext(join(import.meta.dir, '..'), Bun.version)
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
  if (failed) process.exit(1)
}

if (import.meta.main) main(process.argv.slice(2))
