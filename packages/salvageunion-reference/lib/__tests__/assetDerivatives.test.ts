import { describe, expect, test } from 'bun:test'
import {
  ASSET_RENDER_QUALITY,
  ASSET_RENDER_WIDTHS,
  assetDerivativeUrl,
  isServedDerivative,
  parseAssetDerivative,
} from '../assetDerivatives'

/**
 * The artwork CDN's derivative contract: the app writes these URLs and the CDN
 * reads them back, so a URL the one builds must be one the other serves.
 */

const MASTER = 'https://assets.salvageunion.io/chassis/mule.webp'

describe('the derivative contract', () => {
  test('two widths, at one quality', () => {
    // Pinned: each one widens what the CDN will render through Cloudflare
    // Images, which bills per unique transformation.
    expect([...ASSET_RENDER_WIDTHS]).toEqual([440, 880])
    expect(ASSET_RENDER_QUALITY).toBe(80)
  })

  test('every URL the app builds is one the CDN serves, from the same master', () => {
    for (const width of ASSET_RENDER_WIDTHS) {
      const url = assetDerivativeUrl(MASTER, width)
      expect(url).toBe(`https://assets.salvageunion.io/chassis/mule-${width}q80.webp`)
      const key = url.replace('https://assets.salvageunion.io/', '')
      const parsed = parseAssetDerivative(key)
      expect(parsed).toEqual({ masterKey: 'chassis/mule.webp', width, quality: 80 })
      expect(parsed !== null && isServedDerivative(parsed)).toBe(true)
    }
  })

  test('an older key names no quality and still serves', () => {
    const parsed = parseAssetDerivative('chassis/mule-440.webp')
    expect(parsed).toEqual({ masterKey: 'chassis/mule.webp', width: 440, quality: undefined })
    expect(parsed !== null && isServedDerivative(parsed)).toBe(true)
  })

  test('any other width or quality is refused, and a master is no derivative', () => {
    expect(isServedDerivative({ width: 441, quality: 80 })).toBe(false)
    expect(isServedDerivative({ width: 440, quality: 90 })).toBe(false)
    expect(parseAssetDerivative('chassis/mule.webp')).toBeNull()
  })
})
