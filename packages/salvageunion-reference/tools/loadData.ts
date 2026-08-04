/**
 * Shared data-loading helper for the validation tooling.
 *
 * Every validator used to independently `readFileSync` + `JSON.parse` the
 * data files it needed. This module centralizes that so:
 *   - `tools/validate.ts` (the unified runner) can load every `data/*.json`
 *     file exactly once and hand the same in-memory bag to all checks.
 *   - Standalone `validate:*` scripts can still load data themselves (they
 *     run as separate processes either way), without re-deriving the
 *     `data/` path resolution in each file.
 *
 * `dataDir` is resolved relative to this file's location (not `process.cwd()`)
 * so every caller gets the same directory regardless of where `bun` was
 * invoked from.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Absolute path to `packages/salvageunion-reference/data`. */
export const dataDir = join(__dirname, '..', 'data')

/** Every `*.json` filename in `data/`, sorted for deterministic ordering. */
export function listDataFiles(): string[] {
  return readdirSync(dataDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
}

/**
 * Parse a single data file by filename (e.g. `"chassis.json"`). Every data
 * file is a top-level array of entity-shaped objects (validated fully by
 * validateSchemas against its Zod schema); checks work with that assumption,
 * matching how the pre-extraction validator scripts typed their own
 * `loadData` helpers.
 */
export function loadDataFile(filename: string): Record<string, unknown>[] {
  const content = readFileSync(join(dataDir, filename), 'utf-8')
  const parsed = JSON.parse(content) as unknown
  return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : []
}

/**
 * A single shared-load pass over every data file: filename -> parsed array.
 * This is the "load once" bag every check in `tools/validate.ts` reads from.
 */
export type DataBag = Record<string, Record<string, unknown>[]>

export function loadAllDataFiles(): DataBag {
  const bag: DataBag = {}
  for (const filename of listDataFiles()) {
    bag[filename] = loadDataFile(filename)
  }
  return bag
}
