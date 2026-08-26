/**
 * generate-lp-asset-derivatives — width-constrained copies of the entity
 * artwork in the "lp-assets" Netlify Blobs store.
 *
 * ## Why
 *
 * The stored masters are print scans. Measured across all 57 blobs:
 *
 *   total            30,858,850 B  (30.9 MB)
 *   largest           1,295,746 B  bio-titans/typhon.webp
 *   average             ~541,000 B
 *   dimensions   up to 6098 x 7016  (42.8 megapixels)
 *
 * `CardImage` renders them into a container that is **220 CSS px** wide (180 in
 * compact), so a 6098px master is a ~28x linear oversample — roughly 780x the
 * pixels actually painted. Every reader of an illustrated entity page pays a
 * megabyte for a thumbnail.
 *
 * ## What it does
 *
 * For each master `{schema}/{slug}.webp` it writes `{schema}/{slug}-{w}.webp`
 * for each width in `WIDTHS`, and nothing else. It is:
 *
 *   - **additive** — the master is never modified or deleted. It stays the
 *     largest `srcset` candidate and the source for the og:image screenshots,
 *     which render the catalog tile at a 1440 viewport.
 *   - **idempotent** — a derivative that already exists is skipped, so a
 *     re-run after adding one width does not re-encode the rest.
 *   - **never upscaling** — `withoutEnlargement` means a master narrower than
 *     a target width is copied at its own size rather than blown up.
 *
 * The image bytes are licensed from Leyline Press ("do not redistribute") and
 * live only in Blobs, never in git — so this reads from the store and writes
 * back to it, exactly as `convert-lp-assets-to-webp.ts` does.
 *
 * Usage:
 *   NETLIFY_SITE_ID=<su-assets site id> bun tools/generate-lp-asset-derivatives.ts [--dry-run] [--prefix <p>]
 *
 * Requires the Netlify CLI installed and logged in (`netlify login`), and sharp.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const STORE = 'lp-assets'

/**
 * Derivative widths.
 *
 * The render slot is 220 CSS px (`CardImage`'s `containerWidth`), so 440 covers
 * a 2x display and 880 covers 4x with room to spare. The master remains the
 * top `srcset` candidate for anything wider — currently only the og:image
 * screenshot pass, which lays the catalog tile out at 1440.
 *
 * Keep this list short. Every entry is 57 more objects in the store and 57 more
 * encodes on a re-run, and a width nothing selects is pure cost.
 */
const WIDTHS = [440, 880] as const

const DRY_RUN = process.argv.includes('--dry-run')
const prefixFlag = process.argv.indexOf('--prefix')
const PREFIX = prefixFlag === -1 ? null : process.argv[prefixFlag + 1]

function netlify(args: string[]): string {
  return execFileSync('netlify', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/** Every key in the store. */
function listKeys(): string[] {
  const out = netlify(['blobs:list', STORE])
  return [...out.matchAll(/\b([a-z0-9-]+\/[a-z0-9.-]+\.webp)\b/g)].map((m) => m[1] as string)
}

/** `chassis/aegis.webp` -> `chassis/aegis-440.webp` */
function derivativeKey(key: string, width: number): string {
  return key.replace(/\.webp$/, `-${width}.webp`)
}

/** A master is any `.webp` that is not itself a derivative. */
function isMaster(key: string): boolean {
  return !/-\d+\.webp$/.test(key)
}

const tmp = mkdtempSync(join(tmpdir(), 'lp-derivatives-'))
let written = 0
let skipped = 0
let bytesBefore = 0
let bytesAfter = 0

try {
  const keys = listKeys()
  const existing = new Set(keys)
  const masters = keys.filter(isMaster).filter((k) => !PREFIX || k.startsWith(PREFIX))

  console.log(`${keys.length} object(s) in ${STORE}; ${masters.length} master(s) to consider.`)
  if (DRY_RUN) console.log('DRY RUN — nothing will be written.\n')

  for (const key of masters) {
    const todo = WIDTHS.filter((w) => !existing.has(derivativeKey(key, w)))
    if (todo.length === 0) {
      skipped++
      continue
    }

    const localMaster = join(tmp, key.replace(/\//g, '__'))
    netlify(['blobs:get', STORE, key, '--output', localMaster])
    const master = readFileSync(localMaster)
    const meta = await sharp(master).metadata()
    bytesBefore += master.byteLength

    for (const width of todo) {
      const out = await sharp(master)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, effort: 6 })
        .toBuffer()
      bytesAfter += out.byteLength

      const label = `${key} ${meta.width}x${meta.height} ${master.byteLength}B -> ${width}w ${out.byteLength}B`
      if (DRY_RUN) {
        console.log(`  would write ${derivativeKey(key, width)}   (${label})`)
      } else {
        const localOut = join(tmp, `${width}-${key.replace(/\//g, '__')}`)
        writeFileSync(localOut, out)
        netlify(['blobs:set', STORE, derivativeKey(key, width), '--input', localOut])
        console.log(`  wrote ${derivativeKey(key, width)}   (${label})`)
      }
      written++
    }
  }

  console.log(
    `\n${written} derivative(s) ${DRY_RUN ? 'would be ' : ''}written, ${skipped} master(s) already complete.`
  )
  if (bytesBefore > 0) {
    const pct = Math.round((1 - bytesAfter / (bytesBefore * WIDTHS.length)) * 100)
    console.log(
      `masters read: ${bytesBefore} B | derivatives produced: ${bytesAfter} B (${pct}% smaller than the same count of masters)`
    )
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
