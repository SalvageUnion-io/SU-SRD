#!/usr/bin/env bun

/**
 * upload-lp-assets — push Salvage Union entity artwork into the `su-lp-assets`
 * R2 bucket that backs https://assets.salvageunion.io.
 *
 * This is the **ingest path**, and for a period after the Cloudflare cutover
 * there was not one: this tool still wrote to the retired Netlify Blobs store
 * while production read from R2, so adding new artwork was impossible by any
 * documented means and running it would have reported success while touching
 * nothing anyone serves. See `export-lp-assets.ts` for the same story on the
 * backup side.
 *
 * The artwork is licensed from Leyline Press ("do not redistribute") so the
 * BYTES never live in this public repo — only this tool does. Point it at a
 * local directory of images (kept outside git) laid out as:
 *
 *     <dir>/<category>/<file>     e.g.  <dir>/chassis/iron-mongrel.webp
 *
 * Each file is stored under the object key "<category>/<file>" — exactly the
 * path that appears after the host in an asset URL — so the su-assets Worker
 * serves it at https://assets.salvageunion.io/<category>/<file>.
 *
 * ## Usage
 *
 *   R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
 *     bun tools/upload-lp-assets.ts <dir> [--bucket <name>] [--dry-run]
 *
 * Mint the token scoped to this one bucket — see `tools/lib/r2.ts`.
 *
 * Re-runnable and idempotent (R2 `PUT` overwrites), which is also the workflow
 * for adding new artwork later, and for restoring from an export.
 *
 * @public CLI entry — invoked by an operator, not imported.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { credentialsFromEnv, putObject } from './lib/r2.ts'

const DEFAULT_BUCKET = 'su-lp-assets'

/**
 * Content types this tool will upload, keyed by extension.
 *
 * An allowlist rather than a lookup with a fallback: the su-assets Worker
 * refuses to serve any extension it does not recognise, so uploading one would
 * put bytes in the bucket that the origin answers 404 for — a silent, and
 * expensive-to-notice, no-op.
 */
const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    // Skip an export's own manifest and any dotfile — a restore run points at an
    // export directory, and `manifest.json` is metadata, not artwork.
    if (entry.startsWith('.') || entry === 'manifest.json') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const bucketIdx = argv.indexOf('--bucket')
  const bucket = bucketIdx !== -1 ? (argv[bucketIdx + 1] as string) : DEFAULT_BUCKET
  const root = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--bucket')

  if (!root) {
    console.error(
      'usage: R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \\\n' +
        '         bun tools/upload-lp-assets.ts <image-dir> [--bucket <name>] [--dry-run]'
    )
    process.exit(1)
  }

  const creds = dryRun
    ? { accountId: '', accessKeyId: '', secretAccessKey: '' }
    : credentialsFromEnv()

  const files = walk(root)
  if (files.length === 0) {
    console.error(`error: no files found under "${root}"`)
    process.exit(1)
  }

  // Reject unknown extensions BEFORE uploading anything, so a directory with one
  // stray file does not end up half-applied against production storage.
  const unsupported = files.filter((f) => !CONTENT_TYPES[f.split('.').pop()?.toLowerCase() ?? ''])
  if (unsupported.length > 0) {
    console.error(`error: ${unsupported.length} file(s) have an extension su-assets cannot serve:`)
    for (const f of unsupported) console.error(`    ${relative(root, f)}`)
    console.error(`  supported: ${Object.keys(CONTENT_TYPES).join(', ')}`)
    process.exit(1)
  }

  let ok = 0
  const failed: string[] = []

  for (const file of files) {
    const key = relative(root, file).split('\\').join('/')
    const contentType = CONTENT_TYPES[file.split('.').pop()?.toLowerCase() as string] as string
    try {
      if (dryRun) {
        console.log(`  · ${key} (${contentType}) — dry run, not uploaded`)
      } else {
        await putObject(creds, bucket, key, readFileSync(file), contentType)
        console.log(`  ✓ ${key}`)
      }
      ok += 1
    } catch (err) {
      failed.push(`${key}: ${(err as Error).message}`)
      console.error(`  ✗ ${key}`)
    }
  }

  console.log(
    `\n${dryRun ? 'would upload' : 'uploaded'} ${ok}/${files.length} object(s) to bucket "${bucket}"`
  )
  if (failed.length > 0) {
    console.error(`failed:\n${failed.map((k) => `  ${k}`).join('\n')}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`\n✗ ${(err as Error).message}`)
  process.exit(1)
})
