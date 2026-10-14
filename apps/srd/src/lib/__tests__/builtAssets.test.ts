import { describe, expect, test } from 'bun:test'
import { builtAssetUrl, ELDRIDGE_COAST_MAP } from '../builtAssets'

describe('builtAssetUrl', () => {
  test("returns the emitted URL for a source asset Vite's manifest names", () => {
    const assets = { [ELDRIDGE_COAST_MAP]: '/assets/eldridge-coast-map-Bx1.webp' }
    expect(builtAssetUrl(assets, ELDRIDGE_COAST_MAP)).toBe('/assets/eldridge-coast-map-Bx1.webp')
  })

  test('throws, naming the missing source and every known one, rather than an empty src', () => {
    const assets = { 'src/assets/b.webp': '/assets/b.webp', 'src/assets/a.webp': '/assets/a.webp' }
    expect(() => builtAssetUrl(assets, ELDRIDGE_COAST_MAP)).toThrow(
      `No built asset for "${ELDRIDGE_COAST_MAP}". Is it imported by src/runtime/assets.entry.ts? Known: src/assets/a.webp, src/assets/b.webp`
    )
  })

  test('says so when the manifest names nothing at all', () => {
    expect(() => builtAssetUrl({}, ELDRIDGE_COAST_MAP)).toThrow('Known: <none>')
  })
})
