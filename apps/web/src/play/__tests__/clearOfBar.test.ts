/**
 * r4 A4 (SB4-20, LG4-22): the rolled row sat half under the sticky Apply bar.
 * `clearOfBar` brings it to the pane's centre where the bar covers any of it,
 * and leaves a row that is clear of the bar where it is.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { clearOfBar } from '../clearOfBar'

afterEach(() => {
  document.body.innerHTML = ''
})

/** A resolve whose rolled row ends at `rowBottom` and whose bar starts at `barTop`. */
function resolveWith(rowBottom: number, barTop: number) {
  const host = document.createElement('div')
  host.innerHTML =
    '<div class="su-roll"><div aria-current="true"></div></div><div class="su-play-resolve__forward"></div>'
  document.body.appendChild(host)
  const row = host.querySelector('[aria-current="true"]') as HTMLElement
  const bar = host.querySelector('.su-play-resolve__forward') as HTMLElement
  row.getBoundingClientRect = () => ({ top: rowBottom - 40, bottom: rowBottom }) as DOMRect
  bar.getBoundingClientRect = () => ({ top: barTop, bottom: barTop + 48 }) as DOMRect
  const scrolls: ScrollIntoViewOptions[] = []
  row.scrollIntoView = (options?: boolean | ScrollIntoViewOptions) => {
    scrolls.push(options as ScrollIntoViewOptions)
  }
  return { host, scrolls }
}

describe('clearOfBar', () => {
  test('a rolled row the Apply bar covers is brought to the centre', () => {
    const { host, scrolls } = resolveWith(420, 400)
    clearOfBar(host)
    expect(scrolls).toHaveLength(1)
    expect(scrolls[0]?.block).toBe('center')
  })

  test('a rolled row above the bar stays put', () => {
    const { host, scrolls } = resolveWith(400, 400)
    clearOfBar(host)
    expect(scrolls).toEqual([])
  })

  test('nothing rolled, nothing moves', () => {
    const host = document.createElement('div')
    expect(() => clearOfBar(host)).not.toThrow()
    expect(() => clearOfBar(null)).not.toThrow()
  })
})
