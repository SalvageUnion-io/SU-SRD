#!/usr/bin/env bun

/**
 * export-lp-assets — pull every blob out of the "lp-assets" Netlify Blobs store
 * (the bytes behind https://assets.salvageunion.io) into a local directory, and
 * prove the copy is complete and byte-exact.
 *
 * ## Why this exists
 *
 * The artwork is licensed from Leyline Press ("used with special permission …
 * do not redistribute"). It therefore lives ONLY in Blobs — never in this public
 * repo — and it serves two production domains. That made it a single point of
 * failure holding third-party licensed material, and the tool that put it there
 * (`upload-lp-assets.ts`) was deleted as dead code in #725, so for a while the
 * store had no backup, no export path AND no ingest path.
 *
 * ADR-033 retires Netlify. Restoring the ingest tool and adding this one is
 * Phase 1 of that plan, and it is worth doing **whether or not the migration
 * proceeds** — after the cutover R2 becomes the only copy, which is the same
 * single-point-of-failure relocated rather than fixed. An export is the second
 * copy.
 *
 * ## What "verified" means here
 *
 * A file count is not verification. Two things are checked, and the second is
 * the one that matters:
 *
 *   1. every key in the store manifest produced a local file, and
 *   2. re-downloading each key yields bytes whose SHA-256 matches the file on
 *      disk — a spot check would not have caught a truncated stream.
 *
 * The manifest is written alongside the export as `manifest.json` so a restore
 * can be verified against the same list rather than against a fresh `blobs:list`
 * taken after something has already gone wrong.
 *
 * ## Usage
 *
 *   NETLIFY_SITE_ID=<su-assets site id> bun tools/export-lp-assets.ts <out-dir> [--prefix <p>]
 *
 * Requires the Netlify CLI installed and logged in (`netlify login`).
 *
 * The output directory is laid out exactly as `upload-lp-assets.ts` expects, so
 * a restore is:
 *
 *   NETLIFY_SITE_ID=<id> bun tools/upload-lp-assets.ts <out-dir>
 *
 * @public CLI entry — invoked by an operator, not imported.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const STORE = 'lp-assets'

function netlify(args: string[]): string {
  return execFileSync('netlify', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Every key under `prefix`, recursively.
 *
 * `blobs:list --json` returns `{ blobs: [{ key, etag }], directories: [...] }`
 * and recurses by default (without `-d`), so `blobs` already holds every key.
 * Same call `convert-lp-assets-to-webp.ts` makes — deliberately, so the two
 * tools cannot disagree about what "everything in the store" means.
 */
function listKeys(prefix?: string): string[] {
  const args = ['blobs:list', STORE, '--json']
  if (prefix) args.push('--prefix', prefix)
  const parsed = JSON.parse(netlify(args)) as { blobs?: Array<{ key: string }> }
  return (parsed.blobs ?? []).map((b) => b.key)
}

/**
 * Download one blob to `dest`.
 *
 * `blobs:get --output` writes the file itself rather than streaming through
 * this process, which keeps binary bytes off stdout — passing image data
 * through a shell pipe is how a "successful" export ends up subtly corrupt.
 */
function downloadTo(key: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true })
  netlify(['blobs:get', STORE, key, '--output', dest])
}

function main(): void {
  const args = process.argv.slice(2)
  const outDir = args.find((a) => !a.startsWith('--'))
  const prefixIdx = args.indexOf('--prefix')
  const prefix = prefixIdx !== -1 ? args[prefixIdx + 1] : undefined

  if (!outDir) {
    console.error(
      'usage: NETLIFY_SITE_ID=<id> bun tools/export-lp-assets.ts <out-dir> [--prefix <p>]'
    )
    process.exit(1)
  }
  if (!process.env.NETLIFY_SITE_ID) {
    console.error('error: set NETLIFY_SITE_ID to the su-assets site id')
    process.exit(1)
  }

  const keys = listKeys(prefix)
  if (keys.length === 0) {
    console.error(`error: store "${STORE}" reported 0 keys — refusing to write an empty export`)
    process.exit(1)
  }
  console.log(`store "${STORE}" reports ${keys.length} key(s)${prefix ? ` under "${prefix}"` : ''}`)

  const manifest: Array<{ key: string; bytes: number; sha256: string }> = []
  const failed: string[] = []

  for (const key of keys) {
    const dest = join(outDir, key)
    try {
      downloadTo(key, dest)
      const bytes = readFileSync(dest)
      if (bytes.length === 0) throw new Error('wrote 0 bytes')
      manifest.push({ key, bytes: bytes.length, sha256: sha256(bytes) })
      console.log(`  ✓ ${key} (${bytes.length} bytes)`)
    } catch (err) {
      failed.push(key)
      console.error(`  ✗ ${key}: ${(err as Error).message}`)
    }
  }

  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length}/${keys.length} key(s) failed to export:`)
    for (const k of failed) console.error(`    ${k}`)
    console.error('  → the export is INCOMPLETE. Do not treat it as a backup.')
    process.exit(1)
  }

  // Verify pass. Re-download every key and compare hashes, because the failure
  // this is guarding against is a silently truncated stream — which produces a
  // file that exists, has a plausible size, and is not the artwork.
  console.log(`\nverifying ${manifest.length} object(s) by re-download…`)
  const mismatched: string[] = []
  const tmpRoot = join(outDir, '.verify')
  for (const entry of manifest) {
    const tmp = join(tmpRoot, entry.key)
    try {
      downloadTo(entry.key, tmp)
      if (sha256(readFileSync(tmp)) !== entry.sha256) mismatched.push(entry.key)
    } catch (err) {
      mismatched.push(`${entry.key} (${(err as Error).message})`)
    }
  }

  if (mismatched.length > 0) {
    console.error(`\n✗ ${mismatched.length} object(s) did not match on re-download:`)
    for (const k of mismatched) console.error(`    ${k}`)
    process.exit(1)
  }

  const manifestPath = join(outDir, 'manifest.json')
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ store: STORE, exportedKeys: manifest.length, objects: manifest }, null, 2)}\n`
  )

  const totalBytes = manifest.reduce((sum, e) => sum + e.bytes, 0)
  console.log(
    `\n✓ exported and verified ${manifest.length} object(s), ${totalBytes} bytes total\n` +
      `  manifest: ${manifestPath}\n` +
      `  restore:  NETLIFY_SITE_ID=<id> bun tools/upload-lp-assets.ts ${outDir}\n` +
      `  NOTE: ${tmpRoot} holds the verification copies — delete it before archiving.`
  )
}

main()
