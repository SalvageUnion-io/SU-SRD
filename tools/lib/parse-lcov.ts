import { readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

/**
 * Sum a workspace's line coverage from its lcov, counting ONLY files that belong
 * to that workspace.
 *
 * A test run pulls in source from other workspaces (e.g. srd's `preload-reference`
 * loads `salvageunion-reference`), and Bun reports coverage for every file it
 * loaded. Summing all records therefore charged one workspace for another's
 * uncovered lines — srd read 44.8% because it was being measured mostly on
 * reference-package files its own tests never exercise. Each `SF:` record is
 * resolved and skipped unless it sits inside the workspace being measured, so
 * the ratchet tracks each workspace's own code.
 *
 * Resolve against the WORKSPACE ROOT, not the lcov directory. Bun writes `SF:`
 * relative to the cwd it ran in, which is the workspace root, not
 * `<workspace>/coverage` — so resolving against the lcov dir left every path one
 * level too deep, and whether that mattered depended on how far the import
 * reached. `apps/srd`'s `../../packages/…` landed outside `apps/srd` either way
 * and read correctly; `packages/component-lib`'s `../salvageunion-reference/…`
 * resolved to `packages/component-lib/salvageunion-reference/…`, which looks
 * local. component-lib alone was therefore charged for 4,600 lines of the
 * reference package and read 76% against a real 86%.
 */
export function parseLcov(
  path: string,
  workspaceRoot: string
): { linesFound: number; linesHit: number } {
  const contents = readFileSync(path, 'utf-8')
  let linesFound = 0
  let linesHit = 0
  let include = false
  for (const line of contents.split('\n')) {
    if (line.startsWith('SF:')) {
      const file = line.slice(3).trim()
      const abs = isAbsolute(file) ? file : resolve(workspaceRoot, file)
      include = !relative(workspaceRoot, abs).startsWith('..')
      continue
    }
    if (!include) continue
    if (line.startsWith('LF:')) linesFound += Number(line.slice(3))
    if (line.startsWith('LH:')) linesHit += Number(line.slice(3))
  }
  return { linesFound, linesHit }
}
