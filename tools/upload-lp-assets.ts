/**
 * upload-lp-assets — push Salvage Union entity artwork into the "lp-assets"
 * Netlify Blobs store that backs https://assets.salvageunion.io (the su-assets
 * site). This replaces the former hosted Storage bucket.
 *
 * The artwork is licensed from Leyline Press ("do not redistribute") so the
 * BYTES never live in this public repo — only this tool does. Point it at a
 * local directory of images (kept outside git) laid out as:
 *
 *     <dir>/<category>/<file>     e.g.  <dir>/chassis/iron-mongrel.jpg
 *
 * Each file is stored under the blob key "<category>/<file>" (exactly the path
 * that appears after the host in an asset_url), so the asset function can serve
 * it at https://assets.salvageunion.io/<category>/<file>.
 *
 * Usage:
 *   NETLIFY_SITE_ID=<su-assets site id> bun tools/upload-lp-assets.ts <dir>
 *
 * Requires the Netlify CLI to be installed and logged in (`netlify login`).
 * Re-runnable / idempotent — also the workflow for adding new artwork later.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const STORE = 'lp-assets'

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function main(): void {
  const root = process.argv[2]
  if (!root) {
    console.error('usage: bun tools/upload-lp-assets.ts <image-dir>')
    process.exit(1)
  }
  if (!process.env.NETLIFY_SITE_ID) {
    console.error('error: set NETLIFY_SITE_ID to the su-assets site id')
    process.exit(1)
  }

  const files = walk(root)
  let ok = 0
  const failed: string[] = []

  for (const file of files) {
    const key = relative(root, file).split('\\').join('/')
    try {
      execFileSync('netlify', ['blobs:set', STORE, key, '--input', file], { stdio: 'ignore' })
      ok++
      console.log(`  ✓ ${key}`)
    } catch {
      failed.push(key)
      console.error(`  ✗ ${key}`)
    }
  }

  console.log(`\nuploaded ${ok}/${files.length} to store "${STORE}"`)
  if (failed.length) {
    console.error(`failed:\n${failed.map((k) => `  ${k}`).join('\n')}`)
    process.exit(1)
  }
}

main()
