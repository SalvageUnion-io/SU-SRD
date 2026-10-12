/**
 * The workspace dependency graph, read from the manifests, and the set of
 * workspaces a diff can break.
 *
 * Pre-push uses it to pick which suites to run (`tools/pre-push-test.ts`).
 * Bun's own `--changed` selects by module graph but stops at the workspace
 * boundary: edit a `salvageunion-reference` module and component-lib's run
 * reports "no test files are affected". So selection is by workspace, and a
 * workspace drags in every workspace that depends on it, directly or not.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { discoverWorkspaceDirs } from './workspaceCoverage'

const ROOT = join(import.meta.dir, '..', '..')

export type Workspace = {
  /** Repo-relative directory, e.g. `packages/component-lib`. */
  dir: string
  /** The manifest `name`, which `bun --filter` takes. */
  name: string
  /** Names of the workspaces it depends on through a `workspace:` range. */
  deps: string[]
}

/**
 * Repo-root paths every suite reads: the shared preloads in `test/`, the root
 * bunfig and the manifests that fix the resolved tree. A change here runs all.
 */
const SHARED = [/^test\//, /^bunfig\.toml$/, /^package\.json$/, /^bun\.lock$/]

/**
 * `tools/` holds the repo-wide gates, and its tests read the whole tree
 * (`.claude/`, workflows, every app's CSP), so any change at all runs it.
 */
const ALWAYS = 'tools'

/** Every workspace (`tools/` included) with its `workspace:` dependencies. */
export function readWorkspaces(root: string = ROOT): Workspace[] {
  return [...discoverWorkspaceDirs(), 'tools'].map((dir) => {
    const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf-8')) as {
      name: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    const ranges = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    }
    const deps = Object.entries(ranges)
      .filter(([, range]) => range.startsWith('workspace:'))
      .map(([name]) => name)
    return { dir, name: manifest.name, deps }
  })
}

/**
 * The workspaces whose suites `changed` can break, by manifest name, sorted.
 * `null` (no base to diff against) selects every workspace.
 */
export function selectWorkspaces(
  changed: readonly string[] | null,
  workspaces: readonly Workspace[]
): string[] {
  const all = workspaces.map((ws) => ws.name).sort()
  if (changed === null || changed.some((file) => SHARED.some((re) => re.test(file)))) return all
  if (changed.length === 0) return []

  const selected = new Set<string>([ALWAYS])
  for (const file of changed) {
    const owner = workspaces.find((ws) => file.startsWith(`${ws.dir}/`))
    if (owner) selected.add(owner.name)
  }
  // Pull in dependents until nothing new joins.
  let grew = true
  while (grew) {
    grew = false
    for (const ws of workspaces) {
      if (!selected.has(ws.name) && ws.deps.some((dep) => selected.has(dep))) {
        selected.add(ws.name)
        grew = true
      }
    }
  }
  return all.filter((name) => selected.has(name))
}
