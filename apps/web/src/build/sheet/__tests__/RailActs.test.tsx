import { afterEach, describe, expect, it } from 'bun:test'
import { act, render } from '@testing-library/react'
import { RailActs } from '../RailActs'

/** The bar as `AppBar` serves it: a rail per area, the bar's `data-mode` showing one. */
function mountBar(mode: string): HTMLElement {
  const bar = document.createElement('header')
  bar.className = 'su-union-bar'
  bar.setAttribute('data-mode', mode)
  for (const area of ['build', 'play']) {
    const rail = document.createElement('nav')
    rail.setAttribute('data-area', area)
    const slot = document.createElement('span')
    slot.setAttribute('data-rail-acts', '')
    // jsdom lays nothing out: a slot has a box when its rail is the bar's mode.
    Object.defineProperty(slot, 'offsetParent', {
      get: () => (bar.getAttribute('data-mode') === area ? rail : null),
    })
    rail.append(slot)
    bar.append(rail)
  }
  document.body.append(bar)
  return bar
}

const slotOf = (bar: HTMLElement, area: string) =>
  bar.querySelector(`[data-area="${area}"] [data-rail-acts]`)

const realMatchMedia = window.matchMedia

describe('RailActs', () => {
  afterEach(() => {
    window.matchMedia = realMatchMedia
    document.querySelector('.su-union-bar')?.remove()
  })

  it('follows the rail when the bar changes area under an open page', async () => {
    window.matchMedia = (() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
    const bar = mountBar('build')
    render(
      <RailActs>
        <button type="button">Edit</button>
      </RailActs>
    )
    expect(slotOf(bar, 'build')?.textContent).toBe('Edit')

    // A pilot found to be in a Game: its sheet reads under Play, and the Play rail shows.
    await act(async () => {
      bar.setAttribute('data-mode', 'play')
      await Promise.resolve()
    })
    expect(slotOf(bar, 'play')?.textContent).toBe('Edit')
    expect(slotOf(bar, 'build')?.textContent).toBe('')
  })
})
