/**
 * Reading a parsed GitHub Actions workflow or composite action
 * (`Bun.YAML.parse`'s output): its steps, the local actions they call, and
 * its job graph. `tools/check-workflows.ts` holds the invariants; this is the
 * shape they read.
 */

export type Yaml = Record<string, unknown>

/** A workflow or composite action: its repo-relative path and parsed document. */
export type WorkflowFile = { path: string; doc: Yaml }

/** A step and where it sits: `jobs.<id>.steps[n]` or `runs.steps[n]`. */
export type Step = { where: string; step: Yaml }

export const isObject = (v: unknown): v is Yaml =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

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

/** `./.github/actions/<name>` -> its `action.yml` (or `.yaml`) among `files`. */
export function localAction(
  files: readonly WorkflowFile[],
  uses: unknown
): WorkflowFile | undefined {
  if (typeof uses !== 'string' || !uses.startsWith('./.github/actions/')) return undefined
  const dir = uses.slice(2).replace(/\/+$/, '')
  return files.find((f) => f.path === `${dir}/action.yml` || f.path === `${dir}/action.yaml`)
}

/**
 * `stepsOf`, with every local composite action a step `uses` read through:
 * its steps follow the calling step, each `where` the caller's
 * (`jobs.<id>.steps[n]`) plus the action's own, so `jobOf` still names the
 * job. What a job does is the same whether a step is inline or in an action.
 */
export function expandedStepsOf(
  files: readonly WorkflowFile[],
  f: WorkflowFile,
  seen: ReadonlySet<string> = new Set()
): Step[] {
  const out: Step[] = []
  for (const s of stepsOf(f)) {
    out.push(s)
    const action = localAction(files, s.step.uses)
    if (!action || seen.has(action.path)) continue
    for (const inner of expandedStepsOf(files, action, new Set([...seen, action.path]))) {
      out.push({ where: `${s.where} > ${action.path} ${inner.where}`, step: inner.step })
    }
  }
  return out
}

/** Shell text with comment lines removed — prose about a command is not the command. */
export const executable = (script: string): string =>
  script
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')

/** A job's `needs:`, string or list, as a list. */
export function needsOf(job: unknown): string[] {
  if (!isObject(job)) return []
  const needs = job.needs
  if (typeof needs === 'string') return [needs]
  return Array.isArray(needs) ? needs.filter((n): n is string => typeof n === 'string') : []
}

/** `jobs.<id>.steps[n]` -> `<id>`. */
export const jobOf = (where: string): string => where.split('.')[1] ?? ''

/** Every job `job` transitively `needs`. */
export function ancestorsOf(jobs: Yaml, job: string): Set<string> {
  const seen = new Set<string>()
  const queue = needsOf(jobs[job])
  while (queue.length > 0) {
    const next = queue.pop() as string
    if (seen.has(next)) continue
    seen.add(next)
    queue.push(...needsOf(jobs[next]))
  }
  return seen
}
