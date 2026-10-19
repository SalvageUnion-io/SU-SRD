/**
 * A contentful Token's chips take at most two lines; past that the second
 * ends in +MORE, which opens its Peek (`chips-and-actions.md` C5, the one
 * exception to C3). `moreFit` is the arithmetic; `fitMore` reads a strip
 * laid out by a stand-in for the browser's flex wrap.
 */
import { describe, expect, test } from 'bun:test'
import { chipLines, fitMore, MORE_LINES, moreFit, watchMore } from '../parts/chipFit'

describe('chipLines', () => {
  test('packs whole chips onto lines with the 4px gap', () => {
    expect(chipLines([40, 40, 40], 128)).toBe(1)
    expect(chipLines([40, 40, 40], 127)).toBe(2)
    expect(chipLines([40, 40, 40], 40)).toBe(3)
  })

  test('a chip wider than the room never fits', () => {
    expect(chipLines([40, 90], 80)).toBe(Number.POSITIVE_INFINITY)
  })

  test('takes the strip’s own gap', () => {
    expect(chipLines([40, 40], 88, 8)).toBe(1)
    expect(chipLines([40, 40], 87, 8)).toBe(2)
  })
})

describe('moreFit', () => {
  test(`chips on at most ${MORE_LINES} lines are all shown, with no +MORE`, () => {
    expect(moreFit([40, 40, 40, 40], 30, 84)).toBe(4)
    expect(moreFit([], 30, 84)).toBe(0)
  })

  test('past two lines: the most chips from the front that fit two lines with +MORE after them', () => {
    // Two 40px chips a line: six chips take three lines. With a 30px +MORE,
    // the second line holds one chip and it.
    expect(moreFit([40, 40, 40, 40, 40, 40], 30, 84)).toBe(3)
    // A wide +MORE takes a line of its own.
    expect(moreFit([40, 40, 40, 40, 40, 40], 60, 84)).toBe(2)
  })

  test('drops chips whole from the end, never reordering: a short chip late stays dropped', () => {
    // Each 80px chip takes a line: only the first fits two lines with +MORE,
    // and the short last chip, which would fit, is not pulled forward.
    expect(moreFit([80, 80, 80, 10], 30, 84)).toBe(1)
  })
})

/**
 * A contentful Token as `Token` draws it: the head, its strip of lanes (the
 * slot in the last), and +MORE beside the head. `layout` stands in for the
 * browser: the drawn chips wrap left to right in `room`, 18px a line.
 */
function token(widths: number[], { room, more = 30 }: { room: number; more?: number }) {
  const el = document.createElement('div')
  el.className = 'su-entity-token'
  el.setAttribute('data-contentful', '')
  el.innerHTML = `
    <a class="su-entity-token__head"><span class="su-entity-token__pill">
      <span class="su-chips su-entity-token__chips">
        <span class="su-chip-lane" data-chip-class="economy">${widths.map((w) => `<span data-w="${w}"></span>`).join('')}</span>
        <span class="su-chip-lane" data-chip-class="menu"><span class="su-chip-more-slot" hidden></span></span>
      </span>
    </span></a>
    <span class="su-entity-token__more" hidden><button>+MORE</button></span>`
  document.body.append(el)
  const strip = el.querySelector('.su-entity-token__chips') as HTMLElement
  const moreEl = el.querySelector('.su-entity-token__more') as HTMLElement
  const slot = el.querySelector('.su-chip-more-slot') as HTMLElement
  Object.defineProperty(strip, 'clientWidth', { get: () => room })
  const drawn = (chip: HTMLElement) =>
    !chip.hidden && !chip.hasAttribute('data-chip-over') && (chip !== slot || !slot.hidden)
  const rect = (left: number, top: number, width: number) =>
    ({ left, top, width, height: width ? 18 : 0, right: left + width, bottom: top + 18 }) as DOMRect
  const place = () => {
    const boxes = new Map<HTMLElement, DOMRect>()
    let x = 0
    let line = 0
    for (const chip of strip.querySelectorAll<HTMLElement>('[data-w], .su-chip-more-slot')) {
      if (!drawn(chip)) {
        boxes.set(chip, rect(0, 0, 0))
        continue
      }
      const w = chip === slot ? more : Number(chip.dataset.w)
      if (x > 0 && x + 4 + w > room) {
        line += 1
        x = 0
      }
      const left = x === 0 ? 0 : x + 4
      boxes.set(chip, rect(left, line * 22, w))
      x = left + w
    }
    return boxes
  }
  for (const chip of strip.querySelectorAll<HTMLElement>('[data-w], .su-chip-more-slot')) {
    chip.getBoundingClientRect = () => place().get(chip) ?? rect(0, 0, 0)
  }
  const button = moreEl.firstElementChild as HTMLElement
  button.getBoundingClientRect = () => (moreEl.hidden ? rect(0, 0, 0) : rect(0, 0, more))
  el.getBoundingClientRect = () => rect(0, 0, room)
  const over = () =>
    [...strip.querySelectorAll<HTMLElement>('[data-w]')].filter((c) =>
      c.hasAttribute('data-chip-over')
    ).length
  return { el, moreEl, slot, over }
}

describe('fitMore', () => {
  test('chips on two lines all show, +MORE hidden', () => {
    const t = token([40, 40, 40, 40], { room: 84 })
    fitMore(t.el)
    expect(t.over()).toBe(0)
    expect(t.moreEl.hidden).toBe(true)
    expect(t.slot.hidden).toBe(true)
    t.el.remove()
  })

  test('past two lines the rest go over and +MORE lies on its slot, at the second line’s end', () => {
    const t = token([40, 40, 40, 40, 40, 40], { room: 84 })
    fitMore(t.el)
    expect(t.over()).toBe(3)
    expect(t.moreEl.hidden).toBe(false)
    expect(t.slot.hidden).toBe(false)
    expect(t.slot.style.width).toBe('30px')
    // The slot follows the one chip on the second line.
    expect(t.moreEl.style.getPropertyValue('--su-more-x')).toBe('44px')
    expect(t.moreEl.style.getPropertyValue('--su-more-y')).toBe('22px')
    t.el.remove()
  })

  test('it starts from every chip, so the same width draws the same and a wider one brings them back', () => {
    const t = token([40, 40, 40, 40, 40, 40], { room: 84 })
    fitMore(t.el)
    fitMore(t.el)
    expect(t.over()).toBe(3)
    t.el.remove()
    const wide = token([40, 40, 40, 40, 40, 40], { room: 300 })
    fitMore(wide.el)
    expect(wide.over()).toBe(0)
    expect(wide.moreEl.hidden).toBe(true)
    wide.el.remove()
  })

  test('a Token without +MORE (no Peek to open) is left as it is', () => {
    const el = document.createElement('div')
    el.innerHTML =
      '<a class="su-entity-token__head"><span class="su-entity-token__chips"></span></a>'
    expect(() => fitMore(el)).not.toThrow()
    expect(watchMore(el)()).toBeUndefined()
  })
})
