/**
 * A contentful Token's overflow (`chips-and-actions.md` C2b): its head is one
 * line, and what of its chips does not fit beside the name's floor leaves the
 * head for its body's first row. `stripRoom` is the arithmetic;
 * `fitTokenOverflow` reads a Token laid out by a stand-in for the browser.
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
 * A contentful Token as `Token` draws it: the head and its pill (`pill` wide,
 * a 6px column gap), the name's cut-out, the strip (a 4px gap) with an
 * economy lane of `widths` and, given `cost`, a cost lane; then the body, its
 * overflow row first. Each chip measures its `data-w`.
 */
function token(widths: number[], { pill, cost }: { pill: number; cost?: number }) {
  const el = document.createElement('div')
  el.className = 'su-entity-token'
  el.setAttribute('data-contentful', '')
  el.innerHTML = `
    <a class="su-entity-token__head"><span class="su-entity-token__pill" style="column-gap: 6px">
      <span class="su-entity-token__notch"><span class="su-entity-token__name">Name</span></span>
      <span class="su-chips su-entity-token__chips" style="column-gap: 4px">
        <span class="su-chip-lane" data-chip-class="economy">${widths.map((w, i) => `<span data-w="${w}" id="c${i}">chip ${i}</span>`).join('')}</span>
        ${cost === undefined ? '' : `<span class="su-chip-lane" data-chip-class="cost"><span data-w="${cost}" data-cost>cost</span></span>`}
      </span>
    </span></a>
    <div class="su-entity-token__body"><div class="su-chips su-chip-overflow" data-chip-overflow hidden></div><p>Text</p></div>`
  document.body.append(el)
  const pillEl = el.querySelector('.su-entity-token__pill') as HTMLElement
  let width = pill
  Object.defineProperty(pillEl, 'clientWidth', { get: () => width })
  for (const chip of el.querySelectorAll<HTMLElement>('[data-w]')) {
    chip.getBoundingClientRect = () => ({ width: Number(chip.dataset.w) }) as DOMRect
  }
  const row = el.querySelector('[data-chip-overflow]') as HTMLElement
  const out = () =>
    [...el.querySelectorAll<HTMLElement>('.su-entity-token__chips [data-w]')]
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

  test('a Token with no overflow row is left as it is', () => {
    const el = document.createElement('div')
    el.innerHTML =
      '<a class="su-entity-token__head"><span class="su-entity-token__chips"></span></a>'
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

  /** After the next frame and the task it queues, when a deferred fit has run. */
  const afterFrame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 10)))

  /** A ResizeObserver whose callbacks the test fires. */
  function fakeObserver() {
    const fired: (() => void)[] = []
    let disconnected = 0
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        fired.push(() => callback([], this as unknown as ResizeObserver))
      }
      observe() {}
      unobserve() {}
      disconnect() {
        disconnected += 1
      }
    } as unknown as typeof ResizeObserver
    return { resize: () => fired.at(-1)?.(), disconnected: () => disconnected }
  }

  test('refits when the head changes width, until stopped', () => {
    const observer = fakeObserver()
    let headWidth = 400
    const t = token([80, 80, 80], { pill: 400, cost: 40 })
    const head = t.el.firstElementChild as HTMLElement
    head.getBoundingClientRect = () => ({ width: headWidth }) as DOMRect
    const stop = watchTokenOverflow(t.el)
    expect(t.out()).toEqual(['chip 0'])
    // A height change alone (the fit's own) is no refit; a width change is.
    for (const chip of t.el.querySelectorAll('[data-w]')) chip.removeAttribute('data-fill-out')
    observer.resize()
    expect(t.out()).toEqual([])
    headWidth = 300
    observer.resize()
    expect(t.out()).toEqual(['chip 0'])
    stop()
    expect(observer.disconnected()).toBe(1)
  })

  test('a Token taken off the page stops its own watch', () => {
    const observer = fakeObserver()
    const t = token([80, 80, 80], { pill: 400, cost: 40 })
    watchTokenOverflow(t.el)
    t.el.remove()
    observer.resize()
    expect(observer.disconnected()).toBe(1)
  })

  test("a static page's contentful Tokens fit together once it has laid out", async () => {
    fakeObserver()
    const t = token([80, 80, 80], { pill: 400, cost: 40 })
    watchStaticTokenOverflow(document.body)
    // Not while the page loads: after its next frame.
    expect(t.out()).toEqual([])
    await afterFrame()
    expect(t.out()).toEqual(['chip 0'])
  })
})
