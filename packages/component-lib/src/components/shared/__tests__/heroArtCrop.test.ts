import { describe, expect, test } from 'bun:test'
import { heroArtCrop } from '../heroArtCrop'
import { HERO_ART_CROP } from '../heroArtCrop.data'

describe('heroArtCrop', () => {
  test('scales and offsets the image so the ink box fills the window', () => {
    const [x, y, w, h, aspect] = HERO_ART_CROP['chassis/mule'] ?? []
    const crop = heroArtCrop('https://assets.salvageunion.io/chassis/mule.webp')
    expect(crop?.frame).toEqual({ '--su-art-aspect': aspect })
    expect(parseFloat(String(crop?.image.width))).toBeCloseTo(100 / (w ?? 1), 2)
    expect(parseFloat(String(crop?.image.height))).toBeCloseTo(100 / (h ?? 1), 2)
    expect(parseFloat(String(crop?.image.left))).toBeCloseTo((-100 * (x ?? 0)) / (w ?? 1), 2)
    expect(parseFloat(String(crop?.image.top))).toBeCloseTo((-100 * (y ?? 0)) / (h ?? 1), 2)
  })

  test('reads the key from a sized derivative too', () => {
    expect(heroArtCrop('https://assets.salvageunion.io/chassis/mule-440.webp')).toEqual(
      heroArtCrop('https://assets.salvageunion.io/chassis/mule.webp')
    )
  })

  test('renders unmeasured art whole', () => {
    expect(heroArtCrop('https://assets.salvageunion.io/chassis/not-measured.webp')).toBeNull()
  })

  test('every box lies inside its canvas', () => {
    for (const [x, y, w, h, aspect] of Object.values(HERO_ART_CROP)) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x + w).toBeLessThanOrEqual(1.0001)
      expect(y + h).toBeLessThanOrEqual(1.0001)
      expect(aspect).toBeGreaterThan(0)
    }
  })
})
