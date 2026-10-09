import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const resolver = createRequire(import.meta.url)

/**
 * A committed `salvageunion-reference` file, byte for byte, read at build time.
 *
 * `/schema/<id>.json` and `/schema/<id>.schema.json` serve the package's own
 * `data/<id>.json` and `schemas/<id>.schema.json` verbatim, so what CI
 * validates is exactly what a consumer downloads. Re-serialising the models
 * instead served each row with the `schemaName` that `BaseModel` stamps on it,
 * a key the published schema forbids. `path` is a catalog entry's `dataFile`
 * or `schemaFile`, resolved through the package's `./data/*` and `./schemas/*`
 * exports.
 */
export function readReferenceFile(path: string): string {
  return readFileSync(resolver.resolve(`salvageunion-reference/${path}`), 'utf8')
}
