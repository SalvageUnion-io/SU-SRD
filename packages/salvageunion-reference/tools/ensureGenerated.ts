#!/usr/bin/env bun
/**
 * ensureGenerated — make `lib/generated/` and `schemas/` exist and match their
 * inputs, regenerating only when they do not.
 *
 * Both are gitignored build output: a fresh clone has neither, and nothing in
 * the repo typechecks, tests, builds or serves without them. Every path that
 * reads them runs this first, so none depends on a developer remembering a
 * step:
 *
 *   - the root `postinstall` (a fresh `git clone && bun install`, every CI job
 *     and deploy, and the IDE, which typechecks whatever is on disk)
 *   - the root `typecheck`, `test` and `build`, once before they fan out over
 *     the workspaces, and each app's `dev`
 *   - `tools/testPreload.ts`, so a bare `bun test` works too
 *   - `tools/check.ts`, before it launches checks in parallel
 *
 * ## Why a stamp, not "always regenerate"
 *
 * A full regenerate spawns Biome once per file and takes seconds; the paths
 * above run often, several at once. So the run hashes every input the three
 * generators read — the Zod schemas and manifest (`lib/schemas/`), the data
 * (list projections and the catalog's item counts), `lib/zod.ts`,
 * `lib/naming.ts`, `lib/listProjection.ts`, the generators themselves, the
 * Biome config and `bun.lock` (which pins Zod and Biome) — and compares it with the stamp the last
 * successful run wrote. Equal, and every output present: nothing to do (~50 ms).
 * The stamp is written LAST, so a failed run leaves no stamp and retries.
 *
 * ## Why a lock
 *
 * Its callers overlap: `bun --filter "*" test` starts every workspace at once,
 * and each one whose test preload loads reference data runs this; a dev server
 * may be starting beside them. The first takes the lock
 * (`mkdir` is atomic) and regenerates; the rest wait for it, then find the
 * stamp current and return — so no reader ever sees a half-written file.
 *
 * Usage: ref-generate [--force] (this file is the package's bin)
 */

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'

const PACKAGE_DIR = join(import.meta.dir, '..')
const ROOT = join(PACKAGE_DIR, '..', '..')
const GENERATED_DIR = join(PACKAGE_DIR, 'lib', 'generated')
const SCHEMAS_DIR = join(PACKAGE_DIR, 'schemas')
const STAMP = join(GENERATED_DIR, '.inputs.sha256')
const LOCK = join(PACKAGE_DIR, 'lib', '.generated.lock')
/** A lock older than this belongs to a run that died; take it over. */
const STALE_LOCK_MS = 120_000

function listFiles(dir: string, ext: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith(ext) && !f.endsWith('.test.ts'))
    .map((f) => join(dir, f))
}

/** Every file whose content can change what the three generators write. */
function inputFiles(): string[] {
  return [
    ...listFiles(join(PACKAGE_DIR, 'lib', 'schemas'), '.ts'),
    ...listFiles(join(PACKAGE_DIR, 'data'), '.json'),
    join(PACKAGE_DIR, 'lib', 'zod.ts'),
    join(PACKAGE_DIR, 'lib', 'naming.ts'),
    join(PACKAGE_DIR, 'lib', 'listProjection.ts'),
    join(PACKAGE_DIR, 'tools', 'generateRegistry.ts'),
    join(PACKAGE_DIR, 'tools', 'generateJsonSchemas.ts'),
    join(PACKAGE_DIR, 'tools', 'generateDocs.ts'),
    join(PACKAGE_DIR, 'tools', 'formatWithBiome.ts'),
    join(ROOT, 'biome.jsonc'),
    join(ROOT, 'bun.lock'),
  ].sort()
}

export function inputsHash(): string {
  const hasher = new Bun.CryptoHasher('sha256')
  for (const file of inputFiles()) {
    hasher.update(relative(ROOT, file))
    hasher.update('\0')
    hasher.update(readFileSync(file))
    hasher.update('\0')
  }
  return hasher.digest('hex')
}

/** The stamp: the inputs' hash, then every output it vouches for, one per line. */
function isCurrent(hash: string): boolean {
  if (!existsSync(STAMP)) return false
  const [stamped, ...outputs] = readFileSync(STAMP, 'utf8').trimEnd().split('\n')
  return (
    stamped === hash && outputs.length > 0 && outputs.every((o) => existsSync(join(PACKAGE_DIR, o)))
  )
}

function outputsOnDisk(): string[] {
  const generated = readdirSync(GENERATED_DIR).filter((f) => !f.startsWith('.'))
  const schemas = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.json'))
  return [
    ...generated.map((f) => `lib/generated/${f}`),
    ...schemas.map((f) => `schemas/${f}`),
  ].sort()
}

function runGenerator(script: string): void {
  const r = spawnSync(process.execPath, [join(PACKAGE_DIR, 'tools', script)], {
    cwd: PACKAGE_DIR,
    encoding: 'utf8',
  })
  if (r.status !== 0) {
    throw new Error(
      `ensureGenerated: ${script} failed (exit ${r.status ?? r.signal})\n${r.stdout ?? ''}${r.stderr ?? ''}`
    )
  }
}

function acquireLock(): void {
  mkdirSync(dirname(LOCK), { recursive: true })
  while (true) {
    try {
      mkdirSync(LOCK)
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    try {
      if (Date.now() - statSync(LOCK).mtimeMs > STALE_LOCK_MS)
        rmSync(LOCK, { recursive: true, force: true })
    } catch {
      // Released between the mkdir and the stat: try again.
    }
    Bun.sleepSync(100)
  }
}

/** Regenerate when stale. Returns whether it regenerated. */
export function ensureGenerated(opts: { force?: boolean } = {}): boolean {
  if (!opts.force && isCurrent(inputsHash())) return false
  acquireLock()
  try {
    // Re-read under the lock: whoever held it may have just done the work.
    const hash = inputsHash()
    if (!opts.force && isCurrent(hash)) return false
    rmSync(STAMP, { force: true })
    mkdirSync(GENERATED_DIR, { recursive: true })
    mkdirSync(SCHEMAS_DIR, { recursive: true })
    // A schema dropped from the registry (or a list projection switched off)
    // must not linger as an orphan file that srd would serve and the docs
    // generator would catalog.
    for (const dir of [GENERATED_DIR, SCHEMAS_DIR]) {
      for (const f of readdirSync(dir)) {
        if (f.endsWith('.json') || f.endsWith('.generated.ts')) rmSync(join(dir, f))
      }
    }
    // Registry first: generateJsonSchemas imports the zodSchemaMap it writes,
    // and the docs generator catalogs the schema files that one writes.
    runGenerator('generateRegistry.ts')
    runGenerator('generateJsonSchemas.ts')
    runGenerator('generateDocs.ts')
    writeFileSync(STAMP, `${[hash, ...outputsOnDisk()].join('\n')}\n`)
    return true
  } finally {
    rmSync(LOCK, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const started = performance.now()
  const regenerated = ensureGenerated({ force: process.argv.includes('--force') })
  const ms = Math.round(performance.now() - started)
  console.log(
    regenerated
      ? `✓ salvageunion-reference: regenerated lib/generated/ and schemas/ (${ms} ms)`
      : `✓ salvageunion-reference: lib/generated/ and schemas/ are current (${ms} ms)`
  )
}
