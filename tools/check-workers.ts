#!/usr/bin/env bun
/**
 * check-workers — the three Cloudflare Workers keep one shape (`bun run check workers`).
 *
 * The Workers grew apart one at a time: three entry layouts (`src/worker.ts`,
 * `src/http/worker.ts`, `src/worker/index.ts`), `workers_dev` true, false or
 * unset, `worker:bundle` in three of four, generated `Env` types in two, and a
 * typechecking build in one. Each difference is a question a
 * reader has to answer per app. This gate fails when one comes back:
 *
 *   1. every `apps/<app>/wrangler.jsonc` is one of `WORKER_APPS`, and the
 *      reverse, so a fourth Worker cannot skip the gate or the type generator;
 *   2. `main` is `src/worker/index.ts`, and that file exists;
 *   3. `workers_dev` is an explicit boolean: unset, `routes` silently decides
 *      whether the workers.dev address is live;
 *   4. the package.json has every script in `SCRIPTS`, and the ones in
 *      `SAME_SCRIPTS` read the same in every app;
 *   5. `worker-configuration.d.ts` is committed (the `generated` check keeps it
 *      current);
 *   6. the keys in `SHARED_KEYS` are equal across all three, printed as a diff.
 *
 * `wrangler.jsonc` goes through Bun's JSONC loader, never a text match: the
 * configs are heavily commented.
 *
 * Usage: bun tools/check-workers.ts
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WORKER_APPS } from './check-generated'

/** The scripts every Worker app has. */
export const SCRIPTS = ['dev', 'build', 'test', 'typecheck', 'deploy', 'worker:bundle'] as const

/** Scripts whose command is the same everywhere; the rest are per-app. */
const SAME_SCRIPTS = ['deploy', 'worker:bundle'] as const

/** wrangler.jsonc keys every Worker sets to the same value. */
const SHARED_KEYS = [
  'compatibility_date',
  'compatibility_flags',
  'observability',
  'upload_source_maps',
] as const

export const ENTRY = 'src/worker/index.ts'

const TYPES_FILE = 'worker-configuration.d.ts'

export type WorkerApp = {
  /** Repo-relative, e.g. `apps/srd`. */
  app: string
  config: Record<string, unknown>
  scripts: Record<string, string>
  /** Repo-relative paths that exist under the app, from the set this gate asks about. */
  present: ReadonlySet<string>
}

/** Every problem with the set of Workers, one line each; empty when they agree. */
export function shapeProblems(
  workers: readonly WorkerApp[],
  expected: readonly string[]
): string[] {
  const problems: string[] = []
  const found = workers.map((w) => w.app)
  for (const app of found.filter((a) => !expected.includes(a))) {
    problems.push(
      `${app}: has a wrangler.jsonc but is not in WORKER_APPS (tools/check-generated.ts)`
    )
  }
  for (const app of expected.filter((a) => !found.includes(a))) {
    problems.push(`${app}: in WORKER_APPS but has no wrangler.jsonc`)
  }

  for (const w of workers) {
    if (w.config.main !== ENTRY) {
      problems.push(`${w.app}: main is ${JSON.stringify(w.config.main)}, not "${ENTRY}"`)
    } else if (!w.present.has(`${w.app}/${ENTRY}`)) {
      problems.push(`${w.app}: main ${ENTRY} does not exist`)
    }
    if (typeof w.config.workers_dev !== 'boolean') {
      problems.push(`${w.app}: workers_dev is unset; set it to true or false explicitly`)
    }
    for (const script of SCRIPTS) {
      if (w.scripts[script] === undefined) problems.push(`${w.app}: no "${script}" script`)
    }
    if (!w.present.has(`${w.app}/${TYPES_FILE}`)) {
      problems.push(`${w.app}: no ${TYPES_FILE}; run \`bun run check generated\``)
    }
  }

  const differ = (label: string, read: (w: WorkerApp) => unknown) => {
    const values = workers.map((w) => JSON.stringify(read(w)) ?? 'unset')
    if (new Set(values).size <= 1) return
    problems.push(
      `${label} differs:\n${workers.map((w, i) => `      ${w.app}: ${values[i]}`).join('\n')}`
    )
  }
  for (const key of SHARED_KEYS) differ(`wrangler.jsonc "${key}"`, (w) => w.config[key])
  for (const script of SAME_SCRIPTS) differ(`script "${script}"`, (w) => w.scripts[script])
  return problems
}

/** Every app under `root/apps` with a wrangler.jsonc, read for `shapeProblems`. */
export async function loadWorkers(root: string): Promise<WorkerApp[]> {
  const apps = readdirSync(join(root, 'apps'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, 'apps', d.name, 'wrangler.jsonc')))
    .map((d) => `apps/${d.name}`)
    .sort()
  const workers: WorkerApp[] = []
  for (const app of apps) {
    const config = (
      (await import(join(root, app, 'wrangler.jsonc'))) as { default: Record<string, unknown> }
    ).default
    const manifest = existsSync(join(root, app, 'package.json'))
      ? (JSON.parse(readFileSync(join(root, app, 'package.json'), 'utf8')) as {
          scripts?: Record<string, string>
        })
      : {}
    const present = new Set(
      [ENTRY, TYPES_FILE].map((f) => `${app}/${f}`).filter((p) => existsSync(join(root, p)))
    )
    workers.push({ app, config, scripts: manifest.scripts ?? {}, present })
  }
  return workers
}

/** Run the gate against `root`; returns the exit code. */
export async function main(
  root: string,
  log = console.log,
  error = console.error
): Promise<number> {
  const workers = await loadWorkers(root)
  // A gate that found no Workers proves nothing.
  if (workers.length === 0) {
    error('check-workers: found no apps/*/wrangler.jsonc — wrong root?')
    return 1
  }
  const problems = shapeProblems(workers, WORKER_APPS)
  if (problems.length > 0) {
    error(`check-workers: ${problems.length} problem(s) across ${workers.length} Workers:`)
    for (const p of problems) error(`  ${p}`)
    return 1
  }
  log(
    `check-workers: ${workers.length} Workers share one shape (${ENTRY}, ${SCRIPTS.length} scripts, ${SHARED_KEYS.length} shared keys)`
  )
  return 0
}

if (import.meta.main) process.exit(await main(join(import.meta.dir, '..')))
