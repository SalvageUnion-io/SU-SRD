#!/usr/bin/env bun

/**
 * art-crop — measure where each entity's line art actually sits on its canvas,
 * and write the map the entity page's hero crops to
 * (`packages/component-lib/src/components/compositions/heroArtCrop.data.ts`).
 *
 *   bun run assets:crop
 *
 * ## Why this exists
 *
 * The artwork ships on the book's canvas: the Mule's line art fills 75% × 60%
 * of its image, the Gopher's 57% × 74%, a bio-titan's ~96%. Drawn whole on the
 * page's paper plate, that margin read as ~40% empty paper.
 * The margin differs per image, so no single CSS crop can remove it without
 * clipping the art that fills its canvas; the page needs each image's own
 * content box.
 *
 * The bytes are licensed and never live in git (`apps/su-assets`), so the box
 * is measured here and only the numbers are committed. Re-run it when artwork
 * is added or replaced in R2; an image with no entry renders uncropped.
 *
 * ## How
 *
 * For every entity with `hasArtwork`, fetch its `-440` derivative (same aspect
 * as the master, a fraction of the bytes), decode it to raw RGBA with sharp,
 * and take the bounding box of the pixels that are ink: not transparent and
 * not near-white paper. The box is stored as fractions of the canvas, so it
 * holds at every derivative width.
 *
 * @public CLI entry — invoked by an operator, not imported.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { nameToSlug } from 'salvageunion-reference'
import sharp from 'sharp'

const REPO = resolve(import.meta.dir, '..')
const DATA = join(REPO, 'packages/salvageunion-reference/data')
const OUT = join(REPO, 'packages/component-lib/src/components/compositions/heroArtCrop.data.ts')
const ASSET_BASE_URL = 'https://assets.salvageunion.io'
const ASSET_ORIGIN = new URL(ASSET_BASE_URL).origin
const ART_KEY = /^[a-z0-9-]+\/[a-z0-9-]+$/

/** The ink's box as fractions of the canvas, then its own aspect ratio in pixels. */
type Box = readonly [x: number, y: number, w: number, h: number, aspect: number]

/** `schemaName/slug` for every entity flagged `hasArtwork`, as `getAssetUrl` derives it. */
function artKeys(): string[] {
  const keys: string[] = []
  for (const file of readdirSync(DATA).filter((name) => name.endsWith('.json'))) {
    const schemaName = file.replace(/\.json$/, '')
    const rows: unknown = JSON.parse(readFileSync(join(DATA, file), 'utf8'))
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      if (row?.hasArtwork !== true) continue
      const slug = typeof row.name === 'string' && row.name ? nameToSlug(row.name) : row.id
      keys.push(`${schemaName}/${slug}`)
    }
  }
  return keys.sort()
}

/**
 * The ink's bounding box in RGBA pixels (`width` × `height`, four bytes each)
 * as [x, y, w, h] fractions of the canvas and its pixel aspect ratio, or null
 * when every pixel is transparent or paper.
 */
export function inkBox(px: Uint8Array, width: number, height: number): Box | null {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if ((px[i + 3] ?? 0) <= 16) continue
      if (Math.min(px[i] ?? 0, px[i + 1] ?? 0, px[i + 2] ?? 0) >= 235) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) return null
  const round = (n: number) => Math.round(n * 10000) / 10000
  return [
    round(left / width),
    round(top / height),
    round((right + 1 - left) / width),
    round((bottom + 1 - top) / height),
    round((right + 1 - left) / (bottom + 1 - top)),
  ]
}

async function main() {
  const keys = artKeys()
  const crops: Record<string, Box> = {}
  for (const key of keys) {
    // The key comes from the dataset's names: only a plain `schema/slug`
    // reaches the network, and only ever on the asset origin.
    if (!ART_KEY.test(key)) {
      console.warn(`[art-crop] ${key}: not a schema/slug key, skipped`)
      continue
    }
    const url = new URL(`${key}-440.webp`, `${ASSET_BASE_URL}/`)
    if (url.origin !== ASSET_ORIGIN) throw new Error(`[art-crop] ${key} left the asset origin`)
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[art-crop] ${key}: HTTP ${res.status}, skipped`)
      continue
    }
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const box = inkBox(data, info.width, info.height)
    if (!box) {
      console.warn(`[art-crop] ${key}: no ink found, skipped`)
      continue
    }
    // A box within a hair of the whole canvas crops nothing; leave it out.
    if (box[2] > 0.98 && box[3] > 0.98) continue
    crops[key] = box
  }
  const body = Object.entries(crops)
    .map(([key, box]) => `  '${key}': [${box.join(', ')}],`)
    .join('\n')
  writeFileSync(
    OUT,
    `// Generated by \`bun run assets:crop\` (tools/art-crop.ts). Do not edit by hand.
// Each entity's line art (\`schemaName/slug\`) as [x, y, width, height], fractions
// of its canvas, then the art's own aspect ratio (width / height, in pixels).

export const HERO_ART_CROP: Readonly<
  Record<string, readonly [x: number, y: number, w: number, h: number, aspect: number]>
> = {
${body}
}
`
  )
  console.log(
    `[art-crop] measured ${keys.length} images; ${Object.keys(crops).length} crop, wrote ${OUT}`
  )
}

if (import.meta.main) await main()
