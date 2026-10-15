import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const resolver = createRequire(import.meta.url)

/**
 * A `salvageunion-reference` file, byte for byte, read at build time. `data/`
 * is committed; `schemas/*.schema.json` is generated from the Zod source by
 * the package's `ref-generate` bin, which install, the root `build` and this
 * workspace's `dev` run first.
 *
 * `/schema/<id>.json` and `/schema/<id>.schema.json` serve the package's own
 * `data/<id>.json` and `schemas/<id>.schema.json` verbatim, so what CI
 * validates is exactly what a consumer downloads. `path` is a catalog entry's `dataFile`
 * or `schemaFile`, resolved through the package's `./data/*` and `./schemas/*`
 * exports.
 */
export function readReferenceFile(path: string): string {
  return readFileSync(resolver.resolve(`salvageunion-reference/${path}`), 'utf8')
}
