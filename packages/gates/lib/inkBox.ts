/**
 * inkBox — where a piece of line art sits on its canvas, for `tools/art-crop.ts`.
 * Pure, so the measurement is testable without fetching licensed artwork.
 */

/** The ink's box as fractions of the canvas, then its own aspect ratio in pixels. */
export type Box = readonly [x: number, y: number, w: number, h: number, aspect: number]

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
