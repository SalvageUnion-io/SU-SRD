import { describe, expect, test } from 'bun:test'
import { ASSET_RENDER_QUALITY, ASSET_RENDER_WIDTHS, assetDerivativeUrl } from '../assetDerivatives'

/**
 * The artwork CDN's derivative contract: the app writes these URLs and the
 * zone's rewrite rules render exactly these, so the two must agree.
 */

const MASTER = 'https://assets.salvageunion.io/chassis/mule.webp'

describe('the derivative contract', () => {
  test('two widths, at one quality', () => {
    // Pinned: each one is a zone rewrite rule, and widens what Image
    // Transformations bills per unique transformation.
    expect([...ASSET_RENDER_WIDTHS]).toEqual([440, 880])
    expect(ASSET_RENDER_QUALITY).toBe(80)
  })

  test('every URL the app builds names its width and quality', () => {
    for (const width of ASSET_RENDER_WIDTHS) {
      expect(assetDerivativeUrl(MASTER, width)).toBe(
        `https://assets.salvageunion.io/chassis/mule-${width}q80.webp`
      )
    }
  })
})
