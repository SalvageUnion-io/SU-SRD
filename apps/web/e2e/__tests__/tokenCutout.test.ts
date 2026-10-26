/**
 * The Mini cut-out scan (`_tokenCutout.ts`) on hand-written markup
 * in the Mini's class names: a tab of paper with the paint over it, opening
 * into a paper body, passes; each way the head
 * goes flat is its own fault.
 *
 * happy-dom lays nothing out, so every box is stubbed: an element's
 * `data-box="top bottom"` is its box, each 100px wide.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { MIN_STRIP, scanMiniCutouts, TOKEN_CUTOUT_SELECTORS } from '../_tokenCutout'

const realRect = Element.prototype.getBoundingClientRect

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const [top = 0, bottom = 0] = (this.getAttribute('data-box') ?? '0 0').split(' ').map(Number)
    return {
      top,
      bottom,
      left: 0,
      right: 100,
      width: 100,
      height: bottom - top,
      x: 0,
      y: top,
    } as DOMRect
  }
})

afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect
  // The document is shared with every later file in the run: leave it empty.
  document.body.innerHTML = ''
})

beforeEach(() => {
  document.body.innerHTML = ''
})

const PAPER = 'rgb(251, 250, 247)'
const BAND = 'rgb(115, 201, 230)'

/** The page's paper, which the scan resolves through `--color-paper`. */
const withPaper = (html: string) => `<style>:root { --color-paper: ${PAPER} }</style>${html}`

type Parts = {
  notch?: boolean
  notchBg?: string
  /** The tab's top and foot; the pill runs 0 to 24 with a 1.5px edge on top. */
  tab?: [number, number]
  bodyTop?: number
  bodyBg?: string
}

const token = ({
  notch = true,
  notchBg = PAPER,
  tab = [5, 24],
  bodyTop = 24,
  bodyBg = PAPER,
}: Parts = {}) => {
  const name = '<span class="su-entity-mini__name">Mule</span>'
  const head = notch
    ? `<span class="su-entity-mini__notch" data-box="${tab.join(' ')}" style="background-color: ${notchBg}">${name}</span>`
    : name
  return `<div class="su-entity-mini" data-contentful><span class="su-entity-mini__head"><span class="su-entity-mini__pill" data-box="0 24" style="background-color: ${BAND}; border-top-width: 1.5px">${head}</span></span><div class="su-entity-mini__body" data-box="${bodyTop} 80" style="background-color: ${bodyBg}">Text</div></div>`
}

const GROUND = 'rgb(239, 235, 228)'

/** A header-only Mini: the tab is its ground, on the pill's foot (no edge under it). */
const headerToken = ({ notchBg = GROUND, tab = [5, 24] }: Parts = {}) =>
  `<style>:root { --su-ground: ${GROUND} }</style><a class="su-entity-mini"><span class="su-entity-mini__pill" data-box="0 24" style="background-color: ${BAND}; border-top-width: 1.5px"><span class="su-entity-mini__notch" data-box="${tab.join(' ')}" style="background-color: ${notchBg}"><span class="su-entity-mini__name">Mule</span></span></span></a>`

const scan = () => scanMiniCutouts({ a: TOKEN_CUTOUT_SELECTORS, minStrip: MIN_STRIP })

describe('token cut-out scan', () => {
  test('a paper tab under the paint, opening into a paper body in the band, passes', () => {
    document.body.innerHTML = withPaper(token())
    expect(scan()).toEqual([])
  })

  test('a name on the paint, no tab, is found', () => {
    document.body.innerHTML = withPaper(token({ notch: false }))
    expect(scan()).toEqual(["tab: Mule's name is not on the cut-out"])
  })

  test('a tab that is not the paper is found', () => {
    document.body.innerHTML = withPaper(token({ notchBg: 'rgb(40, 32, 25)' }))
    expect(scan()).toEqual(["paper: Mule's tab is rgb(40, 32, 25), not the paper"])
  })

  test('a thin strip of paint over the tab is found', () => {
    document.body.innerHTML = withPaper(token({ tab: [3.5, 24] }))
    expect(scan()).toEqual(['strip: Mule shows 2.0px of paint over its tab'])
  })

  test("a rule under the tab, the pill's edge, is found", () => {
    document.body.innerHTML = withPaper(token({ tab: [5, 22.5] }))
    expect(scan()).toEqual(["open: Mule's tab stops 1.5px above its body"])
  })

  test("a body on the page's ground, not the tab's paper, is found", () => {
    document.body.innerHTML = withPaper(token({ bodyBg: 'rgb(239, 235, 228)' }))
    expect(scan()).toEqual([
      "ground: Mule's body is rgb(239, 235, 228), not the paper its tab is cut from",
    ])
  })

  test('a Mini that is not drawn is not read', () => {
    document.body.innerHTML = withPaper(
      token({ notch: false }).replace('data-box="0 24"', 'data-box="0 0"')
    )
    expect(scan()).toEqual([])
  })

  test('a header-only tab of its ground, on the foot, passes', () => {
    document.body.innerHTML = withPaper(headerToken())
    expect(scan()).toEqual([])
  })

  test("a header-only tab over the pill's edge, short of its foot, is found", () => {
    document.body.innerHTML = withPaper(headerToken({ tab: [5, 22.5] }))
    expect(scan()).toEqual(["foot: Mule's tab stops 1.5px above its foot"])
  })

  test('a header-only tab that is not its ground is found', () => {
    document.body.innerHTML = withPaper(headerToken({ notchBg: PAPER }))
    expect(scan()).toEqual([`cut: Mule's tab is ${PAPER}, not its ground ${GROUND}`])
  })
})
