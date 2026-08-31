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
 * ADR-033 made restoring this tooling **P1, the first phase of the whole
 * cutover**, because the store then "had no backup, no export path and no ingest
 * path". P1 delivered that against Netlify Blobs. P3–P7 then moved production to
 * R2 and left every artwork tool pointed at the old store, which reconstituted
 * the identical hazard one platform over — the previous version of this file
 * predicted exactly that in its own comment ("after the cutover R2 becomes the
 * only copy, which is the same single-point-of-failure relocated rather than
 * fixed") and was not itself moved.
 *
 * This version targets R2, so the prediction stops being true.
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
 *   R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
 *     bun tools/export-lp-assets.ts <out-dir> [--prefix <p>] [--bucket <name>]
 *
 * Mint the token scoped to this one bucket — see `tools/lib/r2.ts`.
 *
 * The output directory is laid out exactly as `upload-lp-assets.ts` expects, so
 * a restore is:
 *
 *   R2_… bun tools/upload-lp-assets.ts <out-dir>
 *
 * @public CLI entry — invoked by an operator, not imported.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { credentialsFromEnv, getObject, listObjects } from './lib/r2.ts'

const DEFAULT_BUCKET = 'su-lp-assets'

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
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

async function main(): Promise<void> {
  const { positionals, flags } = parseArgs(process.argv.slice(2))
  const outDir = positionals[0]
  const prefix = flags['--prefix']
  const bucket = flags['--bucket'] ?? DEFAULT_BUCKET

  if (!outDir) {
    console.error(
      'usage: R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \\\n' +
        '         bun tools/export-lp-assets.ts <out-dir> [--prefix <p>] [--bucket <name>]'
    )
    process.exit(1)
  }

  const creds = credentialsFromEnv()

  const listing = await listObjects(creds, bucket, prefix)
  if (listing.length === 0) {
    console.error(
      `error: bucket "${bucket}" reported 0 objects — refusing to write an empty export`
    )
    process.exit(1)
  }
  console.log(
    `bucket "${bucket}" reports ${listing.length} object(s)${prefix ? ` under "${prefix}"` : ''}`
  )

  const manifest: Array<{ key: string; bytes: number; sha256: string }> = []
  const failed: string[] = []

  for (const object of listing) {
    const dest = join(outDir, object.key)
    try {
      const bytes = await getObject(creds, bucket, object.key)
      if (bytes.length === 0) throw new Error('received 0 bytes')
      writeTo(dest, bytes)
      manifest.push({ key: object.key, bytes: bytes.length, sha256: sha256(bytes) })
      console.log(`  ✓ ${object.key} (${bytes.length} bytes)`)
    } catch (err) {
      failed.push(object.key)
      console.error(`  ✗ ${object.key}: ${(err as Error).message}`)
    }
  }

  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length}/${listing.length} object(s) failed to export:`)
    for (const k of failed) console.error(`    ${k}`)
    console.error('  → the export is INCOMPLETE. Do not treat it as a backup.')
    process.exit(1)
  }

  // Verify pass. Re-download every key and compare hashes, because the failure
  // this guards against is a silently truncated stream — which produces a file
  // that exists, has a plausible size, and is not the artwork.
  console.log(`\nverifying ${manifest.length} object(s) by re-download…`)
  const mismatched: string[] = []
  for (const entry of manifest) {
    try {
      if (sha256(await getObject(creds, bucket, entry.key)) !== entry.sha256) {
        mismatched.push(entry.key)
      }
    } catch (err) {
      mismatched.push(`${entry.key} (${(err as Error).message})`)
    }
  }

  if (mismatched.length > 0) {
    console.error(`\n✗ ${mismatched.length} object(s) did not match on re-download:`)
    for (const k of mismatched) console.error(`    ${k}`)
    process.exit(1)
  }

  // The verification copies are held in memory rather than on disk, so unlike
  // the Netlify-era version there is no `.verify` directory for an operator to
  // forget to delete before archiving a backup of licensed material.
  rmSync(join(outDir, '.verify'), { recursive: true, force: true })

  const manifestPath = join(outDir, 'manifest.json')
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ bucket, exportedKeys: manifest.length, objects: manifest }, null, 2)}\n`
  )

  const totalBytes = manifest.reduce((sum, e) => sum + e.bytes, 0)
  console.log(
    `\n✓ exported and verified ${manifest.length} object(s), ${totalBytes} bytes total\n` +
      `  manifest: ${manifestPath}\n` +
      `  restore:  bun tools/upload-lp-assets.ts ${outDir}`
  )
}

main().catch((err) => {
  console.error(`\n✗ ${(err as Error).message}`)
  process.exit(1)
})
