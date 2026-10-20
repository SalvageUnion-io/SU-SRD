/**
 * A contentful Token's chips take at most two lines, filling bottom-heavy;
 * past that the bottom line ends in the cost, then +MORE, which opens its
 * Peek (`chips-and-actions.md` C5, the one exception to C3). `moreFit` is the
 * arithmetic; `fitMore` reads a strip laid out by a stand-in for the
 * browser's flex wrap.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import {
  chipLines,
  fitMore,
  MORE_LINES,
  moreFit,
  watchMore,
  watchStaticMore,
} from '../parts/chipFit'

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

  test('when not one chip fits beside +MORE, none is shown', () => {
    expect(moreFit([80, 80, 80], 90, 84)).toBe(0)
  })

  test('the kept chips (the cost and its slots) always show, the bottom line ending in them and +MORE', () => {
    // The cost (the last 40) stays: the bottom line holds it and +MORE, the
    // line above two chips from the front; the rest are dropped.
    expect(moreFit([40, 40, 40, 40, 40, 40], 30, 84, { keep: 1 })).toBe(2)
    // Every chip fitting, the count is of the chips before the kept ones.
    expect(moreFit([40, 40, 40], 30, 84, { keep: 1 })).toBe(2)
    // Past the two lines with the kept chips alone, none before them shows.
    expect(moreFit([40, 80, 80, 80], 30, 84, { keep: 2 })).toBe(0)
  })
})

/**
 * A contentful Token as `Token` draws it: the head, its strip of lanes (the
 * slot in the last), and +MORE beside the head. `layout` stands in for the
 * browser: the drawn chips fill bottom-heavy in `room`, 18px a line; the
 * strip measures `measured` wide (`room` unless a test says otherwise). A
 * `cost` draws in the cost lane after the others.
 */
function token(
  widths: number[],
  {
    room,
    more = 30,
    measured = room,
    cost,
  }: { room: number; more?: number; measured?: number; cost?: number }
) {
  const el = document.createElement('div')
  el.className = 'su-entity-token'
  el.setAttribute('data-contentful', '')
  el.innerHTML = `
    <a class="su-entity-token__head"><span class="su-entity-token__pill">
      <span class="su-chips su-entity-token__chips">
        <span class="su-chip-lane" data-chip-class="economy">${widths.map((w) => `<span data-w="${w}"></span>`).join('')}</span>
        ${cost === undefined ? '' : `<span class="su-chip-lane" data-chip-class="cost"><span data-w="${cost}" data-cost></span></span>`}
        <span class="su-chip-lane" data-chip-class="menu"><span class="su-chip-more-slot" hidden></span></span>
      </span>
    </span></a>
    <span class="su-entity-token__more" hidden><button>+MORE</button></span>`
  document.body.append(el)
  const strip = el.querySelector('.su-entity-token__chips') as HTMLElement
  const moreEl = el.querySelector('.su-entity-token__more') as HTMLElement
  const slot = el.querySelector('.su-chip-more-slot') as HTMLElement
  Object.defineProperty(strip, 'clientWidth', { get: () => measured })
  const drawn = (chip: HTMLElement) =>
    !chip.hidden && !chip.hasAttribute('data-chip-over') && (chip !== slot || !slot.hidden)
  const rect = (left: number, top: number, width: number) =>
    ({ left, top, width, height: width ? 18 : 0, right: left + width, bottom: top + 18 }) as DOMRect
  // Bottom-heavy (`row-reverse`, `wrap-reverse`): the last drawn chip takes
  // the bottom-right corner, each line fills leftward from the right edge, and
  // what does not fit rises a line.
  const place = () => {
    const boxes = new Map<HTMLElement, DOMRect>()
    const placed: { chip: HTMLElement; line: number; right: number; w: number }[] = []
    let x = 0
    let line = 0
    const all = [...strip.querySelectorAll<HTMLElement>('[data-w], .su-chip-more-slot')]
    for (const chip of all.reverse()) {
      if (!drawn(chip)) {
        boxes.set(chip, rect(0, 0, 0))
        continue
      }
      const w = chip === slot ? more : Number(chip.dataset.w)
      if (x > 0 && x + 4 + w > room) {
        line += 1
        x = 0
      }
      const right = x === 0 ? 0 : x + 4
      placed.push({ chip, line, right, w })
      x = right + w
    }
    for (const p of placed) {
      boxes.set(p.chip, rect(room - p.right - p.w, (line - p.line) * 22, p.w))
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
  return { el, strip, moreEl, slot, over }
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

  test('past two lines the rest go over and +MORE lies on its slot, at the bottom line’s right end', () => {
    const t = token([40, 40, 40, 40, 40, 40], { room: 84 })
    fitMore(t.el)
    expect(t.over()).toBe(3)
    expect(t.moreEl.hidden).toBe(false)
    expect(t.slot.hidden).toBe(false)
    expect(t.slot.style.width).toBe('30px')
    // The slot takes the bottom-right corner, after the one chip on that line.
    expect(t.moreEl.style.getPropertyValue('--su-more-x')).toBe('54px')
    expect(t.moreEl.style.getPropertyValue('--su-more-y')).toBe('22px')
    t.el.remove()
  })

  test('the cost is kept: the bottom line ends in the cost, then +MORE', () => {
    const t = token([40, 40, 40, 40, 40], { room: 84, cost: 40 })
    fitMore(t.el)
    const cost = t.strip.querySelector<HTMLElement>('[data-cost]') as HTMLElement
    expect(cost.hasAttribute('data-chip-over')).toBe(false)
    // Two chips from the front above; the cost and +MORE on the bottom line.
    expect(t.over()).toBe(3)
    const at = cost.getBoundingClientRect()
    expect(at.top).toBe(22)
    expect(at.right + 4).toBe(54)
    expect(t.moreEl.style.getPropertyValue('--su-more-x')).toBe('54px')
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

describe('fitMore settling', () => {
  test('a strip that lays out narrower than it measured drops chips until two lines hold', () => {
    // It measures 130px (three chips a line) but lays out at 84px (two).
    const t = token([40, 40, 40, 40, 40, 40], { room: 84, measured: 130 })
    fitMore(t.el)
    expect(t.over()).toBe(3)
    expect(t.moreEl.style.getPropertyValue('--su-more-y')).toBe('22px')
    t.el.remove()
  })
})

describe('watchMore', () => {
  const realObserver = globalThis.ResizeObserver
  const realFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
  afterEach(() => {
    globalThis.ResizeObserver = realObserver
    if (realFonts) Object.defineProperty(document, 'fonts', realFonts)
    else Reflect.deleteProperty(document, 'fonts')
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

  test('refits when the head changes width, and on every font load, until stopped', async () => {
    const loads: (() => void)[] = []
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        addEventListener: (_: string, refit: () => void) => loads.push(refit),
      },
    })
    const observer = fakeObserver()
    let headWidth = 84
    const t = token([40, 40, 40, 40, 40, 40], { room: 84 })
    const head = t.el.firstElementChild as HTMLElement
    head.getBoundingClientRect = () => ({ width: headWidth }) as DOMRect
    const stop = watchMore(t.el)
    expect(t.over()).toBe(3)

    // A font load refits every watched Token from every chip drawn, once the
    // page has laid out with it: all of a frame's loads make one fit.
    for (const chip of t.strip.querySelectorAll('[data-w]')) chip.removeAttribute('data-chip-over')
    for (const refit of loads) refit()
    await afterFrame()
    expect(t.over()).toBe(3)

    // A height change alone (the fit's own) is no refit; a width change is.
    for (const chip of t.strip.querySelectorAll('[data-w]')) chip.removeAttribute('data-chip-over')
    observer.resize()
    expect(t.over()).toBe(0)
    headWidth = 300
    observer.resize()
    expect(t.over()).toBe(3)

    stop()
    expect(observer.disconnected()).toBe(1)
  })

  test('a Token taken off the page stops its own watch', () => {
    const observer = fakeObserver()
    const t = token([40, 40, 40, 40, 40, 40], { room: 84 })
    watchMore(t.el)
    t.el.remove()
    observer.resize()
    expect(observer.disconnected()).toBe(1)
  })

  test('with no ResizeObserver it fits once', () => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver')
    const t = token([40, 40, 40, 40, 40, 40], { room: 84 })
    const stop = watchMore(t.el)
    expect(t.over()).toBe(3)
    expect(() => stop()).not.toThrow()
  })

  test("a static page's contentful Tokens fit together once it has laid out", async () => {
    fakeObserver()
    const t = token([40, 40, 40, 40, 40, 40], { room: 84 })
    watchStaticMore(document.body)
    // Not while the page loads: after its next frame.
    expect(t.over()).toBe(0)
    await afterFrame()
    expect(t.over()).toBe(3)
  })
})
