/**
 * The filter-shift check (`_filterShift.ts`, chrome K17) on hand-made boxes:
 * a still frame passes, a sub-pixel wobble passes; a control pushed sideways,
 * a column reflowed, a control gone or the page scrolled fails. A phone's
 * facets may go when their panel folds, and the List's heads when nothing
 * matches.
 */
import { describe, expect, test } from 'bun:test'
import type { FilterFrame } from '../_filterShift'
import { findFilterShiftFaults } from '../_filterShift'

const box = (x: number, y: number, w = 100, h = 44) => ({ x, y, w, h })

const frame = (boxes: FilterFrame['boxes'], over: Partial<FilterFrame> = {}): FilterFrame => ({
  boxes,
  facets: [],
  open: false,
  panelTop: Number.POSITIVE_INFINITY,
  scrollY: 0,
  ...over,
})

const BASE = {
  'the band': box(0, 56, 1440, 146),
  'input "Filter items by name"': box(80, 226, 323),
  'button "Weapons only"': box(213, 282, 164),
  'column "SLOTS"': box(436, 380, 60, 24),
}

describe('findFilterShiftFaults', () => {
  test('a frame that stood still, or wobbled under a pixel, passes', () => {
    expect(findFilterShiftFaults(frame(BASE), frame(BASE))).toEqual([])
    const wobble = { ...BASE, 'button "Weapons only"': box(213.6, 282.4, 164.5) }
    expect(findFilterShiftFaults(frame(BASE), frame(wobble))).toEqual([])
  })

  test('a control pushed aside and a column reflowed fail, by how far', () => {
    const after = {
      ...BASE,
      'button "Weapons only"': box(537, 308, 164),
      'column "SLOTS"': box(367, 380, 60, 24),
    }
    expect(findFilterShiftFaults(frame(BASE), frame(after))).toEqual([
      'button "Weapons only" moved x +324px, y +26px',
      'column "SLOTS" moved x -69px',
    ])
  })

  test('a control that goes, and a page that scrolls, fail', () => {
    const { 'button "Weapons only"': _gone, ...after } = BASE
    expect(findFilterShiftFaults(frame(BASE), frame(after, { scrollY: 120 }))).toEqual([
      'button "Weapons only" went',
      'the page scrolled 120px',
    ])
  })

  test('a folded panel’s facets and an empty List’s heads may go', () => {
    const before = frame(BASE, { facets: ['button "Weapons only"'], open: true, panelTop: 280 })
    const { 'button "Weapons only"': _facet, 'column "SLOTS"': _column, ...after } = BASE
    expect(findFilterShiftFaults(before, frame(after))).toEqual([])
    // Open still, a facet that goes is a fault.
    expect(findFilterShiftFaults(before, frame(after, { open: true }))).toEqual([
      'button "Weapons only" went',
    ])
  })
})
