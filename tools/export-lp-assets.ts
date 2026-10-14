#!/usr/bin/env bun

/**
 * export-lp-assets — pull every object out of the R2 bucket behind
 * https://assets.salvageunion.io into a local directory, and prove the copy is
 * complete and byte-exact.
 *
 * ## Why this exists
 *
 * The artwork is licensed from Leyline Press ("used with special permission …
 * do not redistribute"). It therefore lives ONLY in object storage — never in
 * this public repo — and it serves two production domains.
 *
 * R2 is otherwise the ONLY copy — a single point of failure. This tool is the
 * backup path; `upload-lp-assets.ts` is the ingest path.
 *
 * ## What "verified" means here
 *
 * A file count is not verification. Two things are checked, and the second is
 * the one that matters:
 *
 *   1. every key in the bucket listing produced a local file, and
 *   2. re-downloading each key yields bytes whose SHA-256 matches the file on
 *      disk — a spot check would not have caught a truncated stream.
 *
 * The key list comes from a real `ListObjectsV2`, not from the dataset. Deriving
 * keys with `getAssetUrl` would enumerate every object the *site* asks for and
 * silently omit any object nothing references — which is precisely the object a
 * backup exists to preserve, since the bytes cannot be re-created from this repo.
 *
 * The manifest is written alongside the export as `manifest.json` so a restore
 * can be verified against the same list rather than against a fresh listing
 * taken after something has already gone wrong.
 *
 * ## Usage
 *
 *   op run --env-file=tools/r2.op.env -- \
 *     bun tools/export-lp-assets.ts <out-dir> [--prefix <p>] [--bucket <name>]
 *
 * Mint the token scoped to this one bucket — see `packages/gates/lib/r2.ts`.
 *
 * The output directory is laid out exactly as `upload-lp-assets.ts` expects, so
 * a restore is:
 *
 *   op run --env-file=tools/r2.op.env -- bun tools/upload-lp-assets.ts <out-dir>
 *
 * @public CLI entry — invoked by an operator, not imported.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { credentialsFromEnv, listObjects, r2Client } from 'gates/lib/r2'

const DEFAULT_BUCKET = 'su-lp-assets'

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Where `key` lands under `outDir`, or a throw when it would land outside it.
 *
 * Object keys come off the network, so a key such as `../../.bashrc` or
 * `/etc/x` must not choose where the export writes (CodeQL #93).
 */
export function destinationFor(outDir: string, key: string): string {
  const root = resolve(outDir)
  const dest = resolve(root, key)
  if (!dest.startsWith(root + sep)) throw new Error(`key escapes the output directory: ${key}`)
  return dest
}

function writeTo(dest: string, bytes: Uint8Array): void {
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, bytes)
}

const VALUE_FLAGS = new Set(['--prefix', '--bucket'])

/**
 * Split argv into positionals and flag values.
 *
 * Written as one pass rather than `indexOf` lookups because a flag's *value*
 * must not also be read as the output directory — `--bucket foo out/` would
 * otherwise export into `foo`.
 */
function parseArgs(argv: string[]): { positionals: string[]; flags: Record<string, string> } {
  const positionals: string[] = []
  const flags: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1]
      if (value === undefined) throw new Error(`${arg} requires a value`)
      flags[arg] = value
      i += 1
    } else if (!arg.startsWith('--')) {
      positionals.push(arg)
    }
  }
  return { positionals, flags }
}

/** The bucket as the export reads it: a listing, and one object's bytes. */
export type ExportSource = {
  list: (prefix: string | undefined) => Promise<Array<{ key: string }>>
  bytes: (key: string) => Promise<Uint8Array>
}

/** The real bucket, through the R2 credentials in the environment. */
function r2Source(bucket: string): ExportSource {
  const client = r2Client(credentialsFromEnv(), bucket)
  return {
    list: (prefix) => listObjects(client, prefix),
    bytes: (key) => client.file(key).bytes(),
  }
}

/** Export and verify the bucket into `<out-dir>`; returns the exit code. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  {
    connect = r2Source,
    log = console.log,
    error = console.error,
  }: {
    connect?: (bucket: string) => ExportSource
    log?: (line: string) => void
    error?: (line: string) => void
  } = {}
): Promise<number> {
  const { positionals, flags } = parseArgs([...argv])
  const outDir = positionals[0]
  const prefix = flags['--prefix']
  const bucket = flags['--bucket'] ?? DEFAULT_BUCKET

  if (!outDir) {
    error(
      'usage: op run --env-file=tools/r2.op.env -- \\\n' +
        '         bun tools/export-lp-assets.ts <out-dir> [--prefix <p>] [--bucket <name>]'
    )
    return 1
  }

  const source = connect(bucket)

  const listing = await source.list(prefix)
  if (listing.length === 0) {
    error(`error: bucket "${bucket}" reported 0 objects — refusing to write an empty export`)
    return 1
  }
  log(`bucket "${bucket}" reports ${listing.length} object(s)${prefix ? ` under "${prefix}"` : ''}`)

  const manifest: Array<{ key: string; bytes: number; sha256: string }> = []
  const failed: string[] = []

  for (const object of listing) {
    try {
      const dest = destinationFor(outDir, object.key)
      const bytes = await source.bytes(object.key)
      if (bytes.length === 0) throw new Error('received 0 bytes')
      writeTo(dest, bytes)
      manifest.push({ key: object.key, bytes: bytes.length, sha256: sha256(bytes) })
      log(`  ✓ ${object.key} (${bytes.length} bytes)`)
    } catch (err) {
      failed.push(object.key)
      error(`  ✗ ${object.key}: ${(err as Error).message}`)
    }
  }

  if (failed.length > 0) {
    error(`\n✗ ${failed.length}/${listing.length} object(s) failed to export:`)
    for (const k of failed) error(`    ${k}`)
    error('  → the export is INCOMPLETE. Do not treat it as a backup.')
    return 1
  }

  // Verify pass. Re-download every key and compare hashes, because the failure
  // this guards against is a silently truncated stream — which produces a file
  // that exists, has a plausible size, and is not the artwork.
  log(`\nverifying ${manifest.length} object(s) by re-download…`)
  const mismatched: string[] = []
  for (const entry of manifest) {
    try {
      if (sha256(await source.bytes(entry.key)) !== entry.sha256) {
        mismatched.push(entry.key)
      }
    } catch (err) {
      mismatched.push(`${entry.key} (${(err as Error).message})`)
    }
  }

  if (mismatched.length > 0) {
    error(`\n✗ ${mismatched.length} object(s) did not match on re-download:`)
    for (const k of mismatched) error(`    ${k}`)
    return 1
  }

  const manifestPath = join(outDir, 'manifest.json')
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ bucket, exportedKeys: manifest.length, objects: manifest }, null, 2)}\n`
  )

  const totalBytes = manifest.reduce((sum, e) => sum + e.bytes, 0)
  log(
    `\n✓ exported and verified ${manifest.length} object(s), ${totalBytes} bytes total\n` +
      `  manifest: ${manifestPath}\n` +
      `  restore:  bun tools/upload-lp-assets.ts ${outDir}`
  )
  return 0
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`\n✗ ${(err as Error).message}`)
      process.exit(1)
    }
  )
}
