/**
 * shrinkWrap: a box as wide as its widest line of text, its own padding
 * included, and fitted again on a resize.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { shrinkWrap } from '../shrinkWrap'

const realRange = document.createRange.bind(document)

/** Lines of the given widths, as a Range over the box would report them. */
function linesOf(widths: number[]) {
  document.createRange = () =>
    ({
      selectNodeContents: () => {},
      getClientRects: () => widths.map((width) => ({ width })),
    }) as unknown as Range
}

afterEach(() => {
  document.createRange = realRange
  document.body.innerHTML = ''
})

describe('shrinkWrap', () => {
  test('sets the box to its widest line plus its padding', () => {
    document.body.innerHTML = '<p class="box" style="padding: 0 10px">Two lines of words</p>'
    linesOf([120.2, 180.6])
    shrinkWrap(document, '.box')
    expect(document.querySelector<HTMLElement>('.box')?.style.inlineSize).toBe('201px')
  })

  test('fits again on a resize', () => {
    document.body.innerHTML = '<p class="box">Words</p>'
    linesOf([100])
    shrinkWrap(document, '.box')
    linesOf([60])
    const realFrame = window.requestAnimationFrame
    window.requestAnimationFrame = (run: FrameRequestCallback) => {
      run(0)
      return 0
    }
    window.dispatchEvent(new Event('resize'))
    window.requestAnimationFrame = realFrame
    expect(document.querySelector<HTMLElement>('.box')?.style.inlineSize).toBe('60px')
  })

  test('leaves a page with no such box alone', () => {
    document.body.innerHTML = '<p>Nothing to fit</p>'
    expect(() => shrinkWrap(document, '.box')).not.toThrow()
  })
})
