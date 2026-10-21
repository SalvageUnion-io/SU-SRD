/**
 * referenceStamp — a fingerprint of salvageunion-reference's sources, for the
 * dev server's dep cache (`vite.config.ts`).
 *
 * Dev pre-bundles the workspace package (`optimizeDeps.include`), and Vite
 * re-bundles only when the lockfile or its config changes, never when a
 * linked package's own files do. A change to the package (round 10: a Hybrid
 * Class's brown) stayed out of the browser until the cache was cleared, while
 * the server's render had it: the listing painted right, then the island's
 * mount repainted it from the stale bundle. The stamp rides the optimizer's
 * config, so any change to the package's sources is a new config hash.
 */

import { createHash } from 'node:crypto'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** The package's directories the bundle is built from. */
const SOURCES = ['lib', 'data']

/** Every file under `dir`, tests left out, in a stable order. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !join(entry.parentPath, entry.name).includes('__tests__'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}

/** A hash of each source file's path, size and modification time under `root`. */
export function referenceStamp(root: string): string {
  const hash = createHash('sha256')
  for (const dir of SOURCES) {
    for (const file of filesUnder(join(root, dir))) {
      const { size, mtimeMs } = statSync(file)
      hash.update(`${relative(root, file)}\0${size}\0${mtimeMs}\n`)
    }
  }
  return hash.digest('hex').slice(0, 16)
}
