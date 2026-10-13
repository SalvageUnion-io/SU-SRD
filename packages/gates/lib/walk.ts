import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every file under `dir` that `keep` accepts, as absolute paths, never entering
 * a directory named in `skip`. A missing `dir` yields `[]`.
 */
export function walk(
  dir: string,
  keep: (path: string) => boolean,
  skip: ReadonlySet<string> = new Set(['node_modules']),
  out: string[] = []
): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, keep, skip, out)
    else if (keep(full)) out.push(full)
  }
  return out
}
