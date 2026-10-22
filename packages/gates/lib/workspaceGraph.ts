/**
 * The workspace dependency graph, read from the manifests.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { discoverWorkspaceDirs } from './workspaceCoverage'

const ROOT = join(import.meta.dir, '..', '..', '..')

export type Workspace = {
  /** Repo-relative directory, e.g. `packages/game-domain`. */
  dir: string
  /** The manifest `name`, which `bun --filter` takes. */
  name: string
  /** Names of the workspaces it depends on through a `workspace:` range. */
  deps: string[]
}

/** A workspace's `package.json`, as far as the gates read it. */
export type PackageManifest = {
  name: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/** Every workspace's manifest under `root`, in `discoverWorkspaceDirs` order. */
export function readManifests(
  root: string = ROOT,
  opts: { withTools?: boolean } = {}
): { dir: string; name: string; manifest: PackageManifest }[] {
  return discoverWorkspaceDirs(root, opts).map((dir) => {
    const manifest = JSON.parse(
      readFileSync(join(root, dir, 'package.json'), 'utf-8')
    ) as PackageManifest
    return { dir, name: manifest.name, manifest }
  })
}

/** Every workspace (`tools/` included) with its `workspace:` dependencies. */
export function readWorkspaces(root: string = ROOT): Workspace[] {
  return readManifests(root, { withTools: true }).map(({ dir, name, manifest }) => {
    const ranges = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    }
    const deps = Object.entries(ranges)
      .filter(([, range]) => range.startsWith('workspace:'))
      .map(([dep]) => dep)
    return { dir, name, deps }
  })
}
