import { describe, expect, it } from 'bun:test'
import {
  CATALOG_TILE_MAX_WIDTH,
  CATALOG_TILE_MIN_WIDTH,
  CATALOG_TILE_PADDING,
  CATALOG_TILE_WIDTHS,
  frameFill,
  OG_HEIGHT,
  OG_WIDTH,
  ogImagePath,
  pickTileWidth,
  TILE_FILL_EPSILON,
} from '../ogCard'

/** Tile height that makes the padded frame exactly canvas-shaped at `width`. */
function heightForCanvasAspect(width: number): number {
  return ((width + CATALOG_TILE_PADDING * 2) * OG_HEIGHT) / OG_WIDTH - CATALOG_TILE_PADDING * 2
}

describe('CATALOG_TILE_WIDTHS', () => {
  it('spans the ladder inclusively, narrowest first', () => {
    expect(CATALOG_TILE_WIDTHS[0]).toBe(CATALOG_TILE_MIN_WIDTH)
    expect(CATALOG_TILE_WIDTHS.at(-1)).toBe(CATALOG_TILE_MAX_WIDTH)
    expect([...CATALOG_TILE_WIDTHS]).toEqual([...CATALOG_TILE_WIDTHS].sort((a, b) => a - b))
  })

  it('never exceeds the canvas, so no candidate is upscaled onto it', () => {
    for (const width of CATALOG_TILE_WIDTHS) {
      expect(width + CATALOG_TILE_PADDING * 2).toBeLessThanOrEqual(OG_WIDTH)
    }
  })
})

describe('frameFill', () => {
  it('is 1 when the frame matches the canvas aspect', () => {
    expect(frameFill(OG_WIDTH, OG_HEIGHT)).toBeCloseTo(1, 10)
    expect(frameFill(OG_WIDTH / 3, OG_HEIGHT / 3)).toBeCloseTo(1, 10)
  })

  it('falls away on both sides of that aspect', () => {
    // Too tall (the shape a mobile-stacked tile letterboxes into) and too wide
    // both lose canvas — which is what makes the maximum worth searching for.
    expect(frameFill(OG_WIDTH, OG_HEIGHT * 2)).toBeCloseTo(0.5, 10)
    expect(frameFill(OG_WIDTH * 2, OG_HEIGHT)).toBeCloseTo(0.5, 10)
  })

  it('treats a degenerate frame as covering nothing', () => {
    expect(frameFill(0, 100)).toBe(0)
    expect(frameFill(100, 0)).toBe(0)
    expect(frameFill(-1, 100)).toBe(0)
  })
})

describe('pickTileWidth', () => {
  it('falls back to the grid width when nothing could be measured', () => {
    expect(pickTileWidth([])).toBe(CATALOG_TILE_MIN_WIDTH)
    // A card that never rendered measures zero — it must not win on a 0-height
    // "perfect" frame, it must be ignored.
    expect(pickTileWidth([{ width: 640, height: 0 }])).toBe(CATALOG_TILE_MIN_WIDTH)
  })

  it('picks the width whose frame is closest to canvas-shaped', () => {
    const measurements = [
      { width: 432, height: 600 }, // far too tall
      { width: 640, height: heightForCanvasAspect(640) }, // exact
      { width: 1008, height: 120 }, // far too wide
    ]
    expect(pickTileWidth(measurements)).toBe(640)
  })

  it('stays at the grid width when the card is already canvas-shaped there', () => {
    const measurements = CATALOG_TILE_WIDTHS.map((width) => ({
      width,
      // A short card: height barely moves as it widens, so widening only
      // stretches the frame past the canvas aspect.
      height: width === CATALOG_TILE_MIN_WIDTH ? heightForCanvasAspect(width) : 120,
    }))
    expect(pickTileWidth(measurements)).toBe(CATALOG_TILE_MIN_WIDTH)
  })

  it('widens for a prose-heavy card that only gets canvas-shaped when wide', () => {
    // Height shrinks as the prose re-wraps — the class/chassis tile shape.
    const measurements = CATALOG_TILE_WIDTHS.map((width) => ({
      width,
      height: Math.max(320, 1200 - width),
    }))
    const picked = pickTileWidth(measurements)
    expect(picked).toBeGreaterThan(CATALOG_TILE_MIN_WIDTH)
    const best = Math.max(
      ...measurements.map((m) =>
        frameFill(m.width + CATALOG_TILE_PADDING * 2, m.height + CATALOG_TILE_PADDING * 2)
      )
    )
    const pickedFill = frameFill(
      picked + CATALOG_TILE_PADDING * 2,
      (measurements.find((m) => m.width === picked)?.height ?? 0) + CATALOG_TILE_PADDING * 2
    )
    expect(pickedFill).toBeGreaterThanOrEqual(best - TILE_FILL_EPSILON)
  })

  it('breaks a near-tie toward the narrower, more catalog-faithful tile', () => {
    const narrowHeight = heightForCanvasAspect(432)
    const wide = { width: 1008, height: heightForCanvasAspect(1008) }
    // The wide candidate fills fractionally better; inside the epsilon the
    // narrow one — the width a reader actually sees in the grid — still wins.
    const narrow = { width: 432, height: narrowHeight + 1 }
    expect(pickTileWidth([narrow, wide])).toBe(432)
  })
})

describe('ogImagePath', () => {
  it('mirrors the item page URL', () => {
    expect(ogImagePath('classes', 'engineer')).toBe('/schema/classes/item/engineer.og.png')
  })

  it('addresses a chassis pattern as an entity in its own right', () => {
    expect(ogImagePath('chassis', 'atlas', 'mk8')).toBe(
      '/schema/chassis/item/atlas/pattern/mk8.og.png'
    )
  })
})
