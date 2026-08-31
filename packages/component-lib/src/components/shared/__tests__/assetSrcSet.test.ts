import { describe, expect, test } from 'bun:test'
import { getAssetUrl, SalvageUnionReference } from 'salvageunion-reference'
import { ASSET_RENDER_WIDTHS, assetSrcSetFor } from '../assetSrcSet.ts'

/**
 * Artwork `srcset`.
 *
 * Moved here from `salvageunion-reference/lib/assets.test.ts` along with the
 * code it covers — the widths describe a render slot this package owns, not a
 * property of the game data.
 *
 * The masters are print scans — 57 objects, 30.9 MB total, up to 1,295,746 B and
 * 6098x7016 — and they were delivered whole into a 220 CSS px slot. Measured on
 * the built page before the srcset existed: 446,622 B of artwork for one
 * chassis. After: 30,588 B.
 *
 * Nothing else can catch a regression here. A missing or wrong `srcset` leaves
 * markup that looks entirely correct and simply downloads the master, and the
 * srd output snapshot compares `<main>` TEXT so it cannot see image attributes
 * at all — it is explicitly documented as not covering them.
 */

const WITH_ARTWORK = SalvageUnionReference.Chassis.all().filter(
  (entity) => getAssetUrl(entity) !== undefined
)

describe('assetSrcSetFor', () => {
  test('there is artwork to check', () => {
    // A vacuous pass would otherwise hide the whole feature disappearing.
    expect(WITH_ARTWORK.length).toBeGreaterThan(10)
  })

  test('is undefined when there is no master URL', () => {
    expect(assetSrcSetFor(undefined)).toBeUndefined()
  })

  test('names one candidate per declared width, with a `w` descriptor', () => {
    for (const entity of WITH_ARTWORK) {
      const srcSet = assetSrcSetFor(getAssetUrl(entity))
      expect(srcSet).toBeDefined()
      const parts = (srcSet ?? '').split(', ')
      expect(parts).toHaveLength(ASSET_RENDER_WIDTHS.length)
      for (const [i, width] of ASSET_RENDER_WIDTHS.entries()) {
        expect(parts[i]).toEndWith(` ${width}w`)
        expect(parts[i]).toContain(`-${width}.webp`)
      }
    }
  })

  test('every candidate is derived from that entity’s own master', () => {
    // A srcset pointing at another entity's artwork would render the wrong
    // picture while passing every structural check above.
    for (const entity of WITH_ARTWORK) {
      const master = getAssetUrl(entity) ?? ''
      const stem = master.replace(/\.webp$/, '')
      for (const candidate of (assetSrcSetFor(master) ?? '').split(', ')) {
        expect(candidate).toStartWith(`${stem}-`)
      }
    }
  })

  test('the master is NOT a candidate', () => {
    // Deliberate: its width varies from 1772px to 7196px and the entity carries
    // no dimensions, so any `w` descriptor for it would be a guess — and a
    // candidate with no descriptor is treated as `1x` and competes with the `w`
    // set. It stays on `src`, for browsers that ignore srcset entirely.
    for (const entity of WITH_ARTWORK) {
      const master = getAssetUrl(entity) ?? ''
      expect(assetSrcSetFor(master)).not.toContain(`${master} `)
      expect((assetSrcSetFor(master) ?? '').endsWith(master)).toBe(false)
    }
  })

  test('every width is one the origin will actually render', () => {
    // The contract this file shares with `ALLOWED_WIDTHS` in
    // apps/su-assets/src/worker.ts. A width added here and not there is a 404,
    // which browsers resolve by quietly falling back to the master rather than
    // by telling anyone — so the two lists drifting apart is silent, and this
    // is the only place it can be caught.
    expect([...ASSET_RENDER_WIDTHS]).toEqual([440, 880])
  })
})
