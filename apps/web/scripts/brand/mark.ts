/**
 * The SU mark: the stencil SU in paper on an ink stamp with a paper edge, the
 * book's five chapter colours along the foot (ruleset §5.1 Stamp, "The book's colour map").
 *
 * The one source of every brand file: `bun run brand` (`build.ts`) writes the
 * SVGs and rasterizes the PNGs and ICO from these strings, and
 * `__tests__/brandMark.test.ts` fails when a committed SVG drifts from them.
 * Font-free geometry, so every rasterizer draws it the same.
 */
import { color } from '../../src/ui/design/tokens'

const SIZE = 512
const RADIUS = 30
/**
 * The paper keyline inside the tile's edge, so the ink stamp stands off the
 * ink Union bar it sits on. Its centre line, inset half its width.
 */
const EDGE = 18

/**
 * The foot band: the chapter colours in the book's order, as `BrandCard`'s
 * foot (`CHAPTER_BAND_COLOR`'s rules, pilot, mech, crawler and denizen).
 */
const FOOT_TONES = [color.wkLine, color.pilot, color.mech, color.crawler, color.denizenBand]
const FOOT_TOP = 388

type Rect = readonly [x: number, y: number, width: number, height: number]

// Each letter is 72 × 100 units with 20-unit strokes; the cuts are the
// stencil breaks, drawn in the ground colour. U sits 88 units right of S.
const S_STROKES: readonly Rect[] = [
  [0, 0, 72, 20],
  [0, 40, 72, 20],
  [0, 80, 72, 20],
  [0, 0, 20, 50],
  [52, 50, 20, 50],
]
const S_CUTS: readonly Rect[] = [
  [50, 0, 8, 20],
  [14, 80, 8, 20],
]
const U_STROKES: readonly Rect[] = [
  [88, 0, 20, 80],
  [140, 0, 20, 80],
  [88, 80, 72, 20],
]
const U_CUTS: readonly Rect[] = [
  [88, 52, 20, 8],
  [140, 52, 20, 8],
]
/** The glyph pair's width in letter units (S 72 + gap 16 + U 72). */
const GLYPHS_WIDTH = 160

const rect = ([x, y, w, h]: Rect, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`

function glyphs(height: number, top: number): string {
  const scale = height / 100
  const left = (SIZE - GLYPHS_WIDTH * scale) / 2
  const strokes = [...S_STROKES, ...U_STROKES].map((r) => rect(r, color.paper)).join('')
  const cuts = [...S_CUTS, ...U_CUTS].map((r) => rect(r, color.ink)).join('')
  return `<g transform="translate(${left} ${top}) scale(${scale})">${strokes}${cuts}</g>`
}

/** Paper flecks on the ink (ruleset §3.5.1): a fixed scatter, so output is stable. */
function flecks(): string {
  let seed = 7
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const dots: string[] = []
  for (let i = 0; i < 160; i++) {
    const x = (next() * SIZE).toFixed(1)
    const y = (next() * (FOOT_TOP - 4)).toFixed(1)
    const r = (1.2 + next() * 2).toFixed(2)
    dots.push(`<circle cx="${x}" cy="${y}" r="${r}"/>`)
  }
  return `<g fill="${color.paper}" opacity="0.2">${dots.join('')}</g>`
}

export type MarkOptions = {
  /** The SVG's `<title>`: the name a screen reader or a tab tooltip gives it. */
  title: string
  /**
   * Discord's avatar: square corners, no paper edge (the circular crop would
   * cut it), and the glyphs scaled down so the crop clears them. Everything
   * else is a rounded tile with a paper edge.
   */
  avatar?: boolean
  /** Paper flecks: only at sizes where they read as texture, not noise. */
  flecks?: boolean
  /** Pixel width and height the SVG declares; its viewBox is always 512. */
  px?: number
}

export function markSvg({
  title,
  avatar = false,
  flecks: withFlecks = false,
  px = SIZE,
}: MarkOptions): string {
  const radius = avatar ? 0 : RADIUS
  const step = SIZE / FOOT_TONES.length
  const foot = FOOT_TONES.map(
    (fill, i) =>
      `<rect x="${i * step}" y="${FOOT_TOP}" width="${step + 0.5}" height="${SIZE - FOOT_TOP}" fill="${fill}"/>`
  ).join('')
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="geometricPrecision">`,
    `<title>${title}</title>`,
    `<defs><clipPath id="su-tile"><rect width="${SIZE}" height="${SIZE}" rx="${radius}"/></clipPath></defs>`,
    `<g clip-path="url(#su-tile)">`,
    `<rect width="${SIZE}" height="${SIZE}" fill="${color.ink}"/>`,
    withFlecks ? flecks() : '',
    foot,
    '</g>',
    avatar
      ? ''
      : `<rect x="${EDGE / 2}" y="${EDGE / 2}" width="${SIZE - EDGE}" height="${SIZE - EDGE}" rx="${RADIUS - EDGE / 2}" fill="none" stroke="${color.paper}" stroke-width="${EDGE}"/>`,
    avatar ? glyphs(200, 96) : glyphs(240, 72),
    '</svg>',
  ]
  return `${parts.join('')}\n`
}
