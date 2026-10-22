/**
 * A contentful Mini's overflow (`chips-and-actions.md` C2b): its head is one
 * line, and what of its chips does not fit beside the name's floor leaves the
 * head for its body's first row. `stripRoom` is the arithmetic;
 * `fitTokenOverflow` reads a Mini laid out by a stand-in for the browser.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import {
  fitTokenOverflow,
  stripRoom,
  watchStaticTokenOverflow,
  watchTokenOverflow,
} from '../parts/chipFit'

describe('stripRoom', () => {
  test('the pill less the name floor (40%, at most 9rem) and a gap', () => {
    // 40% of 200 is 80 (under 144): 200 - 80 - 6.
    expect(stripRoom(200, [], 6, 16)).toBe(114)
    // 9rem (144) is under 40% of 400 (160): 400 - 144 - 6.
    expect(stripRoom(400, [], 6, 16)).toBe(250)
  })

  test('less what else stands on the line, each a gap from the next', () => {
    expect(stripRoom(400, [30, 20], 6, 16)).toBe(250 - 36 - 26)
  })
})

/**
 * A contentful Mini as `Mini` draws it: the head and its pill (`pill` wide,
 * a 6px column gap), the name's cut-out, the strip (a 4px gap) with an
 * economy lane of `widths` and, given `cost`, a cost lane; then the body, its
 * overflow row first. Each chip measures its `data-w`.
 */
function token(widths: number[], { pill, cost }: { pill: number; cost?: number }) {
  const el = document.createElement('div')
  el.className = 'su-entity-mini'
  el.setAttribute('data-contentful', '')
  el.innerHTML = `
    <a class="su-entity-mini__head"><span class="su-entity-mini__pill" style="column-gap: 6px">
      <span class="su-entity-mini__notch"><span class="su-entity-mini__name">Name</span></span>
      <span class="su-chips su-entity-mini__chips" style="column-gap: 4px">
        <span class="su-chip-lane" data-chip-class="economy">${widths.map((w, i) => `<span data-w="${w}" id="c${i}">chip ${i}</span>`).join('')}</span>
        ${cost === undefined ? '' : `<span class="su-chip-lane" data-chip-class="cost"><span data-w="${cost}" data-cost>cost</span></span>`}
      </span>
    </span></a>
    <div class="su-entity-mini__body"><div class="su-chips su-chip-overflow" data-chip-overflow hidden></div><p>Text</p></div>`
  document.body.append(el)
  const pillEl = el.querySelector('.su-entity-mini__pill') as HTMLElement
  let width = pill
  Object.defineProperty(pillEl, 'clientWidth', { get: () => width })
  for (const chip of el.querySelectorAll<HTMLElement>('[data-w]')) {
    chip.getBoundingClientRect = () => ({ width: Number(chip.dataset.w) }) as DOMRect
  }
  const row = el.querySelector('[data-chip-overflow]') as HTMLElement
  const out = () =>
    [...el.querySelectorAll<HTMLElement>('.su-entity-mini__chips [data-w]')]
      .filter((c) => c.hasAttribute('data-fill-out'))
      .map((c) => c.textContent)
  const widen = (to: number) => {
    width = to
  }
  return { el, row, out, widen }
}

describe('fitTokenOverflow', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('chips that fit beside the name all stay; the row stays hidden', () => {
    const t = token([40, 40], { pill: 400 })
    fitTokenOverflow(t.el)
    expect(t.out()).toEqual([])
    expect(t.row.hidden).toBe(true)
    expect(t.el.hasAttribute('data-chip-fitted')).toBe(true)
  })

  test('what does not fit leaves from the front, its copy the body’s first row', () => {
    // Room 250: the cost (40) and two 80s fit (40 + 84 + 84 = 208), the third does not.
    const t = token([80, 80, 80], { pill: 400, cost: 40 })
    fitTokenOverflow(t.el)
    expect(t.out()).toEqual(['chip 0'])
    expect(t.row.hidden).toBe(false)
    const lanes = [...t.row.children]
    expect(lanes.map((lane) => lane.getAttribute('data-chip-class'))).toEqual(['economy'])
    expect(t.row.textContent).toBe('chip 0')
    // A copy carries no id and nothing the fit wrote.
    expect(t.row.querySelector('[id], [data-fill-out]')).toBeNull()
  })

  test('the cost never leaves, even when nothing else fits', () => {
    const t = token([200, 200], { pill: 200, cost: 40 })
    fitTokenOverflow(t.el)
    expect(t.out()).toEqual(['chip 0', 'chip 1'])
    const cost = t.el.querySelector('[data-cost]') as HTMLElement
    expect(cost.hasAttribute('data-fill-out')).toBe(false)
  })

  test('it starts from every chip: a wider pill brings them back and hides the row', () => {
    const t = token([80, 80, 80], { pill: 400, cost: 40 })
    fitTokenOverflow(t.el)
    fitTokenOverflow(t.el)
    expect(t.out()).toEqual(['chip 0'])
    t.widen(900)
    fitTokenOverflow(t.el)
    expect(t.out()).toEqual([])
    expect(t.row.hidden).toBe(true)
    expect(t.row.children.length).toBe(0)
  })

  test('a Mini with no overflow row is left as it is', () => {
    const el = document.createElement('div')
    el.innerHTML = '<a class="su-entity-mini__head"><span class="su-entity-mini__chips"></span></a>'
    expect(() => fitTokenOverflow(el)).not.toThrow()
    expect(watchTokenOverflow(el)()).toBeUndefined()
  })
})

describe('watchTokenOverflow', () => {
  const realObserver = globalThis.ResizeObserver
  afterEach(() => {
    globalThis.ResizeObserver = realObserver
    document.body.innerHTML = ''
  })

  /** A ResizeObserver whose callbacks the test fires. */
  function fakeObserver() {
    const fired: (() => void)[] = []
    let disconnected = 0
    globalThis.ResizeObserver = class {
      observed = new Set<Element>()
      constructor(callback: ResizeObserverCallback) {
        // Each report a new size; the first is the size the fit left.
        let size = 0
        fired.push(() => {
          size += 1
          callback(
            [...this.observed].map(
              (target) =>
                ({ target, contentRect: { width: size, height: 1 } }) as ResizeObserverEntry
            ),
            this as unknown as ResizeObserver
          )
        })
      }
      observe(el: Element) {
        this.observed.add(el)
      }
      unobserve(el: Element) {
        this.observed.delete(el)
      }
      disconnect() {
        disconnected += 1
      }
    } as unknown as typeof ResizeObserver
    return { resize: () => fired.at(-1)?.(), disconnected: () => disconnected }
  }

  test('refits when the Mini resizes, until stopped', () => {
    const observer = fakeObserver()
    const t = token([80, 80, 80], { pill: 400, cost: 40 })
    const stop = watchTokenOverflow(t.el)
    expect(t.out()).toEqual(['chip 0'])
    observer.resize()
    t.widen(900)
    observer.resize()
    expect(t.out()).toEqual([])
    stop()
    expect(observer.disconnected()).toBe(1)
  })

  test('a Mini taken off the page stops its own watch', () => {
    const observer = fakeObserver()
    const t = token([80, 80, 80], { pill: 400, cost: 40 })
    watchTokenOverflow(t.el)
    t.el.remove()
    observer.resize()
    expect(observer.disconnected()).toBe(1)
  })

  test("a static page's contentful Minis each fit on the page's load", () => {
    fakeObserver()
    const t = token([80, 80, 80], { pill: 400, cost: 40 })
    watchStaticTokenOverflow(document.body)
    expect(t.out()).toEqual(['chip 0'])
  })
})
