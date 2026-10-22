/**
 * The bottom-right fill (ruleset §4.7, C2b): a head's chips sit only beside
 * its name, counted from the strip's end; what does not fit leaves the head,
 * for its body's first row or behind +MORE, and never rises above the name.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { overflowPlan } from '../chipFill'
import { watchChipFill, watchStaticChipFill } from '../chipFillWatch'

describe('overflowPlan', () => {
  test('nothing leaves when every chip fits beside the name', () => {
    expect(overflowPlan([20, 20, 20], [false, false, true], 100, 200, 4)).toEqual({
      out: [false, false, false],
      more: false,
    })
  })

  test('the kept ones stay; the rest fill from the end, the first that does not fit and all before it leave', () => {
    // 100 + 4 + 20 (kept) = 124; + 34 = 158 fits; + 44 = 202 does not.
    expect(overflowPlan([50, 40, 30, 20], [false, false, false, true], 100, 200, 4)).toEqual({
      out: [true, true, false, false],
      more: false,
    })
  })

  test('as many as fit stay: a chip before one that left still stays where it fits', () => {
    expect(overflowPlan([5, 90, 10], [false, false, true], 100, 150, 4).out).toEqual([
      false,
      true,
      false,
    ])
  })

  test('a first chip (a measure: Slots) keeps its place ahead of the ones after it', () => {
    // TL (kept) | SLOTS (first) | RNG | DMG: 100 + 24 + 34 = 158; + 64 = 222 does not fit 200.
    expect(
      overflowPlan([20, 30, 60, 60], [true, false, false, false], 100, 200, 4, undefined, [
        false,
        true,
        false,
        false,
      ]).out
    ).toEqual([false, false, true, true])
  })

  test('a first chip that does not fit still leaves: the head never grows', () => {
    expect(
      overflowPlan([20, 120, 10], [true, false, false], 100, 150, 4, undefined, [
        false,
        true,
        false,
      ]).out
    ).toEqual([false, true, false])
  })

  test('a kept chip at the front (the Tech Level) stays while those after it leave', () => {
    expect(overflowPlan([20, 60, 60, 20], [true, false, false, true], 100, 220, 4).out).toEqual([
      false,
      true,
      false,
      false,
    ])
  })

  test('+MORE takes its room after the kept ones, and is drawn only when a chip left', () => {
    // 100 + 24 (kept) + 29 (+MORE) = 153; + 34 = 187 fits; + 44 does not.
    expect(overflowPlan([50, 40, 30, 20], [false, false, false, true], 100, 200, 4, 25)).toEqual({
      out: [true, true, false, false],
      more: true,
    })
    expect(overflowPlan([20], [false], 100, 200, 4, 25)).toEqual({ out: [false], more: false })
  })
})

/**
 * A head as `Head` draws it: its band (`data-chip-overflow-owner` on a
 * contentful head, the overflow row its next sibling), the heading
 * (`data-chip-fill`, `room` wide, 4px gap, `row-reverse` as the fill lays
 * it), its name (`name` wide on one line, `shortest` at its longest word),
 * and a strip that draws no box: an economy lane of `widths`, a cost lane of
 * `cost`, and on a header-only head +MORE (`more` wide) in the menu lane.
 */
function head(
  widths: number[],
  { room, name, shortest = name, cost, route }: Fill & { cost?: number; route?: 'body' | 'more' }
) {
  const band = document.createElement('div')
  if (route === 'body') band.setAttribute('data-chip-overflow-owner', '')
  const el = document.createElement('div')
  el.setAttribute('data-chip-fill', '')
  el.style.columnGap = '4px'
  el.style.display = 'flex'
  el.style.flexDirection = 'row-reverse'
  el.innerHTML = `
    <div data-fill-name=""></div>
    <div class="su-chips" style="display: contents">
      <span class="su-chip-lane" data-chip-class="economy" style="display: contents">${widths
        .map((w, i) => `<span data-w="${w}" id="chip${i}">chip ${i}</span>`)
        .join('')}<span data-base-ui-focus-guard=""></span></span>
      ${cost === undefined ? '' : `<span class="su-chip-lane" data-chip-class="cost" style="display: contents"><span data-w="${cost}" data-cost="">cost</span></span>`}
      ${route === 'more' ? '<span class="su-chip-lane" data-chip-class="menu" style="display: contents"><span data-w="25" data-chip-more="" hidden>+MORE</span></span>' : ''}
      <span class="su-chip-lane" style="display: none"><span data-w="9"></span></span>
    </div>`
  band.append(el)
  document.body.append(band)
  const row = document.createElement('div')
  row.setAttribute('data-chip-overflow', '')
  row.hidden = true
  if (route === 'body') document.body.append(row)
  Object.defineProperty(el, 'clientWidth', { get: () => room })
  const nameEl = el.querySelector('[data-fill-name]') as HTMLElement
  nameEl.getBoundingClientRect = () =>
    ({ width: nameEl.style.width === 'min-content' ? shortest : name }) as DOMRect
  for (const chip of el.querySelectorAll<HTMLElement>('[data-w]')) {
    chip.getBoundingClientRect = () => ({ width: Number(chip.dataset.w) }) as DOMRect
  }
  return { el, row }
}

type Fill = { room: number; name: number; shortest?: number }

const items = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-fill-item]')]
const out = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>('[data-fill-out]')].map((chip) => chip.textContent)
const prop = (el: HTMLElement, name: string) => el.style.getPropertyValue(name)

describe('watchChipFill', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('orders every chip from the end, all beside the name when they fit', () => {
    const { el } = head([20, 20, 20], { room: 200, name: 100, route: 'body' })
    const stop = watchChipFill(el)
    expect(items(el).map((item) => prop(item, '--su-fill'))).toEqual(['3', '2', '1'])
    expect(prop(el, '--su-beside')).toBe('3')
    expect(prop(el, '--su-items')).toBe('3')
    expect(prop(el, '--su-name-basis')).toBe('auto')
    expect(items(el).every((item) => item.hasAttribute('data-fill-line'))).toBe(true)
    expect(out(el)).toEqual([])
    // Watched once: a second watch is a no-op.
    watchChipFill(el)()
    stop()
  })

  test("on a contentful head what does not fit is the body's first row, never above the name", () => {
    const { el, row } = head([50, 40, 30], { room: 200, name: 100, cost: 20, route: 'body' })
    watchChipFill(el)
    expect(out(el)).toEqual(['chip 0', 'chip 1'])
    expect(prop(el, '--su-beside')).toBe('2')
    expect(row.hidden).toBe(false)
    expect(row.textContent).toBe('chip 0chip 1')
    expect(row.firstElementChild?.getAttribute('data-chip-class')).toBe('economy')
    // The copies carry no id and nothing the fit wrote.
    expect(row.querySelector('[id], [data-fill-item], [data-fill-out]')).toBeNull()
  })

  test('on a header-only head it ends the strip in +MORE, the cost right before it', () => {
    const { el } = head([50, 40, 30], { room: 200, name: 100, cost: 20, route: 'more' })
    watchChipFill(el)
    expect(out(el)).toEqual(['chip 0', 'chip 1'])
    const more = el.querySelector<HTMLElement>('[data-chip-more]') as HTMLElement
    expect(more.hidden).toBe(false)
    const shown = items(el)
    expect(shown.at(-1)).toBe(more)
    expect(shown.at(-2)?.hasAttribute('data-cost')).toBe(true)
  })

  test('+MORE stays hidden while every chip fits', () => {
    const { el } = head([20], { room: 200, name: 100, cost: 20, route: 'more' })
    watchChipFill(el)
    expect(out(el)).toEqual([])
    expect(el.querySelector<HTMLElement>('[data-chip-more]')?.hidden).toBe(true)
  })

  test('a head with nowhere to send a chip sends nothing', () => {
    const { el } = head([50, 40, 30], { room: 200, name: 100, cost: 20 })
    watchChipFill(el)
    expect(out(el)).toEqual([])
  })

  test('the name wraps for the kept chips when not even they fit beside the one-line name', () => {
    const { el } = head([], { room: 200, name: 180, shortest: 80, cost: 60, route: 'body' })
    watchChipFill(el)
    expect(prop(el, '--su-beside')).toBe('1')
    expect(prop(el, '--su-name-basis')).toBe(`${200 - 4 - 60 - 1}px`)
    expect(el.querySelector('[data-fill-corner]')).toBeNull()
  })

  test("a chip too wide beside the name's longest word wraps its value", () => {
    const { el } = head([], { room: 200, name: 120, shortest: 90, cost: 150, route: 'body' })
    watchChipFill(el)
    const corner = el.querySelector<HTMLElement>('[data-fill-corner]')
    expect(corner).not.toBeNull()
    expect(prop(corner as HTMLElement, '--su-corner-max')).toBe(`${200 - 4 - 90 - 1}px`)
    expect(prop(el, '--su-name-basis')).toBe('90px')
  })

  test('a name that ends in "…" gives way to its chips, down to half its line, and no chip wraps', () => {
    const { el } = head([40], { room: 200, name: 180, shortest: 60, cost: 40, route: 'body' })
    const name = el.querySelector<HTMLElement>('[data-fill-name]') as HTMLElement
    name.style.textOverflow = 'ellipsis'
    watchChipFill(el)
    // Half the line (100) and both chips (44 + 44) fit: nothing leaves.
    expect(out(el)).toEqual([])
    expect(el.querySelector('[data-fill-corner]')).toBeNull()
    expect(prop(el, '--su-name-basis')).toBe(`${200 - 88 - 1}px`)
  })

  test("a static page's heads each fit on the page's load", () => {
    const { el } = head([50, 40, 30], { room: 200, name: 100, cost: 20, route: 'body' })
    watchStaticChipFill()
    expect(prop(el, '--su-beside')).toBe('2')
  })

  test('heads off screen fit in later turns, the root marked until the last has', async () => {
    const heads = Array.from(
      { length: 6 },
      () => head([50, 40, 30], { room: 200, name: 100, cost: 20, route: 'body' }).el
    )
    watchStaticChipFill()
    expect(document.documentElement.hasAttribute('data-chip-fitting')).toBe(true)
    while (document.documentElement.hasAttribute('data-chip-fitting')) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    expect(heads.map((el) => prop(el, '--su-beside'))).toEqual(Array(6).fill('2'))
  })

  test('a head with no name is left alone', () => {
    const el = document.createElement('div')
    el.setAttribute('data-chip-fill', '')
    document.body.append(el)
    watchChipFill(el)
    expect(prop(el, '--su-items')).toBe('')
  })
})
