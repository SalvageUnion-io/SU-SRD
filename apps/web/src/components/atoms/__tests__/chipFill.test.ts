/**
 * The bottom-right fill (ruleset §4.7): a head's chips start beside its name,
 * counted from the strip's end, and only what overfills the name's line rises.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { besideCount, watchChipFill, watchStaticChipFill } from '../chipFill'

describe('besideCount', () => {
  test('every chip that fits beside the name, counted from the end', () => {
    // 100 + 4 + 30 + 4 + 40 = 178 fits 200; the 50 before them does not.
    expect(besideCount([50, 40, 30], 100, 200, 4)).toBe(2)
  })

  test('all of them when they fit', () => {
    expect(besideCount([20, 20, 20], 100, 200, 4)).toBe(3)
  })

  test('none when not even the last fits: the caller wraps the name for it', () => {
    expect(besideCount([20, 60], 180, 200, 4)).toBe(0)
  })

  test('stops at the first that does not fit, never skipping past it', () => {
    // The 90 does not fit after the 10; the 5 before it would, but the line
    // is filled from the end in order.
    expect(besideCount([5, 90, 10], 100, 200, 4)).toBe(1)
  })
})

/**
 * A head as `Head` draws it: the heading (`data-chip-fill`, `room` wide, 4px
 * gap), its name (`name` wide on one line, `shortest` at its longest word),
 * and a strip that draws no box, its lanes' chips `widths` wide.
 */
function head(widths: number[], { room, name, shortest = name }: Fill) {
  const el = document.createElement('div')
  el.setAttribute('data-chip-fill', '')
  el.style.columnGap = '4px'
  el.innerHTML = `
    <div data-fill-name=""></div>
    <div class="su-chips" style="display: contents">
      <span class="su-chip-lane" style="display: contents">${widths
        .map((w) => `<span data-w="${w}">chip</span>`)
        .join('')}<span data-base-ui-focus-guard=""></span></span>
      <span class="su-chip-lane" style="display: none"><span data-w="9"></span></span>
    </div>`
  document.body.append(el)
  Object.defineProperty(el, 'clientWidth', { get: () => room })
  const nameEl = el.querySelector('[data-fill-name]') as HTMLElement
  nameEl.getBoundingClientRect = () =>
    ({ width: nameEl.style.width === 'min-content' ? shortest : name }) as DOMRect
  for (const chip of el.querySelectorAll<HTMLElement>('[data-w]')) {
    chip.getBoundingClientRect = () => ({ width: Number(chip.dataset.w) }) as DOMRect
  }
  return el
}

type Fill = { room: number; name: number; shortest?: number }

const items = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-fill-item]')]
const prop = (el: HTMLElement, name: string) => el.style.getPropertyValue(name)

describe('watchChipFill', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('orders every chip from the end and keeps those that fit beside the name', () => {
    const el = head([50, 40, 30], { room: 200, name: 100 })
    const stop = watchChipFill(el)
    expect(items(el).map((item) => prop(item, '--su-fill'))).toEqual(['3', '2', '1'])
    expect(prop(el, '--su-beside')).toBe('2')
    expect(prop(el, '--su-items')).toBe('3')
    expect(prop(el, '--su-name-basis')).toBe('auto')
    expect(items(el).map((item) => item.hasAttribute('data-fill-line'))).toEqual([
      false,
      true,
      true,
    ])
    // Watched once: a second watch is a no-op.
    watchChipFill(el)()
    stop()
  })

  test('the name wraps for the cost when not even it fits beside the one-line name', () => {
    const el = head([20, 60], { room: 200, name: 180, shortest: 80 })
    watchChipFill(el)
    expect(prop(el, '--su-beside')).toBe('1')
    expect(prop(el, '--su-name-basis')).toBe(`${200 - 4 - 60 - 1}px`)
    expect(el.querySelector('[data-fill-corner]')).toBeNull()
  })

  test("a chip too wide beside the name's longest word wraps its value", () => {
    const el = head([150], { room: 200, name: 120, shortest: 90 })
    watchChipFill(el)
    const corner = el.querySelector<HTMLElement>('[data-fill-corner]')
    expect(corner).not.toBeNull()
    expect(prop(corner as HTMLElement, '--su-corner-max')).toBe(`${200 - 4 - 90 - 1}px`)
    expect(prop(el, '--su-name-basis')).toBe('90px')
  })

  test("a static page's heads each fit on the page's load", () => {
    const el = head([50, 40, 30], { room: 200, name: 100 })
    watchStaticChipFill()
    expect(prop(el, '--su-beside')).toBe('2')
  })

  test('a head with no name is left alone', () => {
    const el = document.createElement('div')
    el.setAttribute('data-chip-fill', '')
    document.body.append(el)
    watchChipFill(el)
    expect(prop(el, '--su-items')).toBe('')
  })
})
