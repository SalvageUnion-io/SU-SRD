/**
 * `pickFontPreloads` (`../fontPreloads.ts`) — which emitted webfonts every page
 * preloads, and the build failure when one of them stops being emitted.
 */

import { describe, expect, test } from 'bun:test'
import { PRELOADED_FONTS, pickFontPreloads } from '../fontPreloads'

/** The styles entry's assets as Vite lists them: woff2 and woff, every subset. */
const EMITTED = PRELOADED_FONTS.flatMap((name) => [
  `assets/${name}-Ab_3x-Yz.woff2`,
  `assets/${name}-Qr7.woff`,
  `assets/${name.replace('latin', 'latin-ext')}-Zz9.woff2`,
])

describe('font preloads', () => {
  test('picks the latin woff2 of each preloaded face, site-rooted, in order', () => {
    expect(pickFontPreloads(EMITTED)).toEqual(
      PRELOADED_FONTS.map((name) => `/assets/${name}-Ab_3x-Yz.woff2`)
    )
  })

  test('never mistakes another weight or subset for a preloaded face', () => {
    const others = [
      'assets/barlow-latin-600-normal-H1.woff2',
      'assets/barlow-latin-ext-400-normal-H2.woff2',
    ]
    expect(() => pickFontPreloads(others)).toThrow('barlow-latin-400-normal')
  })

  test('fails the build when a preloaded face is no longer emitted', () => {
    const missing = EMITTED.filter((asset) => !asset.includes('semi-condensed-latin-700'))
    expect(() => pickFontPreloads(missing)).toThrow('barlow-semi-condensed-latin-700-normal')
  })
})
