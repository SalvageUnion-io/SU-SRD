/**
 * The `path-filters` invariant of `tools/check-workflows.ts` (its header says
 * what it holds), kept in its own module.
 */

import type { Yaml } from 'gates/lib/workflowYaml'
import { isObject, stepsOf } from 'gates/lib/workflowYaml'
import { WORKERS } from './check-workers'
import type { CheckResult, WorkflowContext } from './check-workflows'
import { isShared, SHARED_PATHS } from './deploy-surfaces'

const CI = '.github/workflows/ci.yml'

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

/**
 * The `changes` job step that reads the root manifest beyond its `version`
 * (a release bump moves nothing). With it, `package.json` may stay out of
 * `shared`, provided every output whose group carries `*shared` also reads it.
 */
const MANIFEST_STEP = 'manifest'

/** Problems with the `manifest` step's wiring, or null when ci.yml has no such step. */
function manifestStepProblems(ci: Yaml, groups: Map<string, string[]>): string[] | null {
  const changes = isObject(ci.jobs) && isObject(ci.jobs.changes) ? ci.jobs.changes : {}
  const steps = Array.isArray(changes.steps) ? changes.steps : []
  if (!steps.some((step) => isObject(step) && step.id === MANIFEST_STEP)) return null
  const shared = groups.get('shared') ?? []
  const outputs = isObject(changes.outputs) ? changes.outputs : {}
  const read = `steps.${MANIFEST_STEP}.outputs.changed`
  return [...groups]
    .filter(([group, patterns]) => group !== 'shared' && shared.every((p) => patterns.includes(p)))
    .filter(([group]) => !String(outputs[group] ?? '').includes(read))
    .map(
      ([group]) =>
        `${CI}'s \`changes\` output \`${group}\` carries \`*shared\` but not \`${read}\`, so a ` +
        'root package.json change would skip its jobs. Add `|| ' +
        `${read} == 'true'\` to it.`
    )
}

/** The repo-relative directories the root manifest's `file:` overrides point at. */
function fileOverrideDirs(manifests: WorkflowContext['manifests']): string[] {
  return Object.values(manifests.get('package.json')?.overrides ?? {})
    .filter((spec): spec is string => typeof spec === 'string' && spec.startsWith('file:'))
    .map((spec) => spec.slice('file:'.length).replace(/^\.\//, '').replace(/\/$/, ''))
}

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
  const ci = ctx.files.find((f) => f.path === CI)?.doc
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
  if (apps.length < 2) failures.push(`found ${apps.length} app(s); expected at least 2.`)

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
  const manifestStep = manifestStepProblems(ci, groups)
  if (manifestStep) failures.push(...manifestStep)
  for (const entry of deployShared) {
    if (entry === 'package.json' && manifestStep) continue
    const probe = probeFor(entry)
    if (!sharedPaths.some((glob) => glob.match(probe))) {
      failures.push(
        `tools/deploy-surfaces.ts ships every surface on a change to \`${entry}\`, but ${CI}'s ` +
          `\`shared\` group does not cover it (\`${probe}\`) — such a change could deploy an app ` +
          'whose build CI skipped. Add it to `shared`, or drop it from SHARED_PATHS.'
      )
    }
  }
  for (const dir of fileOverrideDirs(ctx.manifests)) {
    if (!covers(shared, dir) || !isShared(`${dir}/x`)) {
      failures.push(
        `package.json overrides a dependency with \`file:${dir}\`, but ${CI}'s \`shared\` group ` +
          `or tools/deploy-surfaces.ts SHARED_PATHS does not cover it — a change there would ` +
          `skip the build or the deploy. Add '${dir}/**' to \`shared\` and '${dir}/' to SHARED_PATHS.`
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
