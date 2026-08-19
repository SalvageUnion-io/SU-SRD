#!/usr/bin/env bun

/**
 * sync-snapshots-to-r2 — copy the `snapshots` Netlify Blobs store into R2
 * (ADR-033 P6), then prove every object arrived intact.
 *
 * ## Why this needs to be careful
 *
 * A snapshot id IS the capability: it is minted per share, it is the whole of
 * the authorization, and it is what a link in a Discord channel points at. A
 * snapshot that does not arrive is a share link that 404s forever, with no way
 * to tell the owner which one broke. So "did every object arrive" is answered by
 * comparing content, not by comparing counts — a truncated read produces an
 * object that exists, has a plausible size, and is not the snapshot.
 *
 * ## Idempotent, and safe to run twice
 *
 * Every key is written unconditionally, so a second run over the same source is
 * a no-op in effect. That matters because P6 runs this TWICE: once as a bulk
 * copy while writes are still live, and once as a delta after the write freeze.
 * The second run is what must reconcile to zero new content.
 *
 * ## Usage
 *
 *   NETLIFY_SITE_ID=<itun site id> bun tools/sync-snapshots-to-r2.ts [--dry-run]
 *
 * Requires the Netlify CLI logged in and wrangler authenticated.
 *
 * @public CLI entry — invoked by an operator, not imported.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BLOBS_STORE = 'snapshots'
const R2_BUCKET = 'su-itun-snapshots'

function netlify(args: string[]): string {
  return execFileSync('netlify', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function wrangler(args: string[]): string {
  return execFileSync('bunx', ['wrangler', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

/**
 * Canonicalised JSON, so a comparison is about the DATA and not about how two
 * platforms happened to serialise it.
 *
 * Netlify Blobs stores what `JSON.stringify` produced; R2 stores what this tool
 * writes. Key order survives both, but whitespace need not, and a byte
 * comparison would report a difference that no client could ever observe.
 * Sorting keys also means a re-serialisation on either side is not a false
 * positive.
 */
function canonical(raw: string): string {
  const value: unknown = JSON.parse(raw)
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys)
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, inner]) => [k, sortKeys(inner)])
      )
    }
    return v
  }
  return JSON.stringify(sortKeys(value))
}

function listBlobKeys(): string[] {
  const parsed = JSON.parse(netlify(['blobs:list', BLOBS_STORE, '--json'])) as {
    blobs?: Array<{ key: string }>
  }
  return (parsed.blobs ?? []).map((b) => b.key)
}

function readBlob(key: string): string {
  return netlify(['blobs:get', BLOBS_STORE, key])
}

function readR2(key: string): string | null {
  try {
    // stderr is swallowed on purpose: "The specified key does not exist" is the
    // ORDINARY answer for a key not yet copied, and letting wrangler print it
    // once per object turns a clean run into a wall of red that hides a real
    // failure. A genuine error still surfaces — it becomes a null here and the
    // caller reports it with the key attached.
    return execFileSync(
      'bunx',
      ['wrangler', 'r2', 'object', 'get', `${R2_BUCKET}/${key}`, '--pipe', '--remote'],
      {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    )
  } catch {
    return null
  }
}

function writeR2(key: string, body: string, tmp: string): void {
  const file = join(tmp, 'payload.json')
  writeFileSync(file, body)
  wrangler([
    'r2',
    'object',
    'put',
    `${R2_BUCKET}/${key}`,
    '--file',
    file,
    '--content-type',
    'application/json',
    '--remote',
  ])
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run')
  if (!process.env.NETLIFY_SITE_ID) {
    console.error('error: set NETLIFY_SITE_ID to the itun site id')
    process.exit(1)
  }

  const keys = listBlobKeys()
  console.log(`store "${BLOBS_STORE}" reports ${keys.length} snapshot(s)`)
  if (keys.length === 0) {
    // Not an error on the delta pass — an empty store after a freeze is the
    // expected outcome only if it was empty before, so say which case this is
    // rather than exiting silently.
    console.log('nothing to sync')
    return
  }

  const tmp = mkdtempSync(join(tmpdir(), 'snapshot-sync-'))
  const copied: string[] = []
  const alreadyIdentical: string[] = []
  const failed: string[] = []

  try {
    for (const key of keys) {
      let source: string
      try {
        source = readBlob(key)
      } catch (err) {
        failed.push(`${key} (read: ${(err as Error).message})`)
        continue
      }

      let sourceCanonical: string
      try {
        sourceCanonical = canonical(source)
      } catch {
        failed.push(`${key} (source is not valid JSON)`)
        continue
      }

      const existing = readR2(key)
      if (existing !== null) {
        try {
          if (canonical(existing) === sourceCanonical) {
            alreadyIdentical.push(key)
            continue
          }
        } catch {
          // Unparseable object already in R2 — overwrite it rather than trust it.
        }
      }

      if (dryRun) {
        copied.push(key)
        console.log(`  would copy ${key}`)
        continue
      }

      try {
        writeR2(key, source, tmp)
        const back = readR2(key)
        if (back === null || canonical(back) !== sourceCanonical) {
          failed.push(`${key} (verify: content differs after write)`)
          continue
        }
        copied.push(key)
        console.log(`  ✓ ${key}`)
      } catch (err) {
        failed.push(`${key} (write: ${(err as Error).message})`)
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }

  console.log(
    `\n${dryRun ? 'would copy' : 'copied'} ${copied.length}, ` +
      `already identical ${alreadyIdentical.length}, failed ${failed.length}`
  )

  if (failed.length > 0) {
    console.error('\n✗ failures:')
    for (const f of failed) console.error(`    ${f}`)
    console.error('  → the sync is INCOMPLETE. Do not proceed to the cutover.')
    process.exit(1)
  }

  // The line P6's gate reads. On the delta pass after the freeze, `copied` must
  // be 0 — anything else means a write landed on Netlify after the freeze was
  // supposed to have stopped them.
  if (dryRun) {
    console.log(`(dry run — nothing was written; ${copied.length} would be copied)`)
    return
  }

  console.log(
    copied.length === 0
      ? '✓ reconciled to zero — every snapshot already present and identical'
      : `✓ ${copied.length} snapshot(s) copied and verified by content`
  )
}

main()
