/**
 * A roll's result is brought on screen only when some of it is off screen,
 * centred, smoothly unless the reader prefers reduced motion.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { revealRolled } from '../revealRolled'

const realMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = realMatchMedia
  document.body.innerHTML = ''
})

/** An element at `top`..`top + 40` in the viewport, recording its scrolls. */
function rowAt(top: number, parent: HTMLElement = document.body) {
  const el = document.createElement('li')
  parent.appendChild(el)
  el.getBoundingClientRect = () => ({ top, bottom: top + 40 }) as DOMRect
  const scrolls: ScrollIntoViewOptions[] = []
  el.scrollIntoView = (options?: boolean | ScrollIntoViewOptions) => {
    scrolls.push(options as ScrollIntoViewOptions)
  }
  return { el, scrolls }
}

const reducedMotion = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
  })) as typeof window.matchMedia
}

describe('revealRolled', () => {
  test('a row wholly on screen stays put', () => {
    const { el, scrolls } = rowAt(100)
    revealRolled(el)
    expect(scrolls).toEqual([])
  })

  test('a row below the fold scrolls smoothly to the centre', () => {
    reducedMotion(false)
    const { el, scrolls } = rowAt(window.innerHeight + 200)
    revealRolled(el)
    expect(scrolls).toEqual([{ behavior: 'smooth', block: 'center' }])
  })

  test('a row partly above the top scrolls too', () => {
    reducedMotion(false)
    const { el, scrolls } = rowAt(-10)
    revealRolled(el)
    expect(scrolls).toHaveLength(1)
  })

  test('a reader who prefers reduced motion jumps instead', () => {
    reducedMotion(true)
    const { el, scrolls } = rowAt(window.innerHeight + 200)
    revealRolled(el)
    expect(scrolls).toEqual([{ behavior: 'auto', block: 'center' }])
  })

  test('a row hidden by a scrolling panel scrolls, though the viewport would show it', () => {
    reducedMotion(false)
    const panel = document.createElement('div')
    panel.style.overflowY = 'auto'
    panel.getBoundingClientRect = () => ({ top: 0, bottom: 200 }) as DOMRect
    document.body.appendChild(panel)
    const { el, scrolls } = rowAt(300, panel)
    revealRolled(el)
    expect(scrolls).toHaveLength(1)
  })

  test('nothing to reveal is a no-op', () => {
    expect(() => revealRolled(null)).not.toThrow()
  })
})
