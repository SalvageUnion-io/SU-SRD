/**
 * convert-lp-assets-to-webp — re-encode every raster blob in the "lp-assets"
 * Netlify Blobs store (the bytes behind https://assets.salvageunion.io) to WebP,
 * in place, so entity artwork is unified on a single format.
 *
 * Why this exists: `getAssetUrl()` now always derives `…/{schema}/{slug}.webp`,
 * so the stored blobs must be WebP for those URLs to resolve. The image bytes
 * are licensed from Leyline Press ("do not redistribute") and live only in
 * Blobs — never in git — so this tool sources them straight from the store
 * rather than from a local directory: list → download → transcode → upload.
 *
 * It is ADDITIVE and idempotent: it writes a new `<name>.webp` key alongside
 * each original and skips any blob whose `.webp` sibling already exists. The
 * original png/jpg blobs are left in place (so nothing 404s while the schema
 * change is still un-deployed). Pass `--delete-originals` to prune them once
 * the new URLs are confirmed live.
 *
 * Run this BEFORE merging the schema change, then merge once it reports done.
 *
 * Usage:
 *   NETLIFY_SITE_ID=<su-assets site id> bun tools/convert-lp-assets-to-webp.ts [--prefix <p>] [--delete-originals] [--dry-run]
 *
 * Requires the Netlify CLI installed and logged in (`netlify login`), and sharp.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const STORE = 'lp-assets'
const RASTER_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'avif'])

function netlify(args: string[]): string {
  return execFileSync('netlify', args, { encoding: 'utf8' })
}

function extOf(key: string): string {
  return key.split('.').pop()?.toLowerCase() ?? ''
}

function webpKey(key: string): string {
  return `${key.slice(0, key.length - extOf(key).length - 1)}.webp`
}

function listKeys(prefix?: string): string[] {
  const args = ['blobs:list', STORE, '--json']
  if (prefix) args.push('--prefix', prefix)
  // `blobs:list --json` returns { blobs: [{ key, etag }], directories: [...] }.
  // Without `-d` it recurses, so `blobs` holds every key under the prefix.
  const parsed = JSON.parse(netlify(args)) as { blobs?: Array<{ key: string }> }
  return (parsed.blobs ?? []).map((b) => b.key)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const deleteOriginals = args.includes('--delete-originals')
  const prefixIdx = args.indexOf('--prefix')
  const prefix = prefixIdx !== -1 ? args[prefixIdx + 1] : undefined

  if (!process.env.NETLIFY_SITE_ID) {
    console.error('error: set NETLIFY_SITE_ID to the su-assets site id')
    process.exit(1)
  }

  const keys = listKeys(prefix)
  const existing = new Set(keys)
  const toConvert = keys.filter((k) => RASTER_EXT.has(extOf(k)) && !existing.has(webpKey(k)))

  console.log(
    `store "${STORE}": ${keys.length} blobs, ${toConvert.length} to convert to webp` +
      (dryRun ? ' (dry run)' : '')
  )
  if (dryRun) {
    for (const k of toConvert) console.log(`  would convert ${k} -> ${webpKey(k)}`)
    return
  }

  const work = mkdtempSync(join(tmpdir(), 'lp-webp-'))
  let ok = 0
  const failed: string[] = []
  try {
    for (const key of toConvert) {
      const src = join(work, 'src')
      const out = join(work, 'out.webp')
      try {
        netlify(['blobs:get', STORE, key, '-O', src])
        // Use a quality that still meaningfully compresses; artwork, not UI
        // chrome, so favour fidelity.
        await sharp(src).webp({ quality: 82 }).toFile(out)
        netlify(['blobs:set', STORE, webpKey(key), '--input', out])
        if (deleteOriginals) netlify(['blobs:delete', STORE, key])
        ok++
        console.log(`  ✓ ${key} -> ${webpKey(key)}${deleteOriginals ? ' (original deleted)' : ''}`)
      } catch (err) {
        failed.push(key)
        console.error(`  ✗ ${key}: ${(err as Error).message}`)
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }

  console.log(`\nconverted ${ok}/${toConvert.length} to webp in store "${STORE}"`)
  if (failed.length) {
    console.error(`failed:\n${failed.map((k) => `  ${k}`).join('\n')}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
