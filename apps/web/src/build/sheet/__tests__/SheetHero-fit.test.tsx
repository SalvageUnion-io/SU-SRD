/**
 * R61 A box fits its content: a Live Sheet's opening is as tall as what is in
 * it. From the 64rem rung, with a sidebar, the Vitals panel heads the sidebar
 * (one render, a portal) and the opening is its fields alone; on a phone the
 * Vitals stay in the opening.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { SheetColumns } from '../SheetColumns'
import { SheetHero } from '../SheetHero'

const realMatchMedia = window.matchMedia
afterEach(() => {
  window.matchMedia = realMatchMedia
  cleanup()
})

/** Every `(width >= …)` query answers `wide`. */
const viewport = (wide: (query: string) => boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide(query),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as never
}

const sheet = () =>
  render(
    <SheetColumns
      hero={
        <SheetHero
          name="Caligula"
          fields={
            <>
              <p>Callsign</p>
              <p>Motto</p>
            </>
          }
          vitals={<p>Hit Points</p>}
        />
      }
      aside={<p>Inventory</p>}
      asideLabel="Carried"
    >
      <section>Abilities</section>
    </SheetColumns>
  )

describe('SheetHero — R61 a box fits its content', () => {
  test('from the 64rem rung the Vitals head the sidebar, drawn once', () => {
    viewport(() => true)
    const { container } = sheet()
    expect(container.querySelectorAll('.su-sheet-vitals')).toHaveLength(1)
    const aside = container.querySelector('[data-sheet-aside]')
    expect(aside?.firstElementChild?.textContent).toContain('Hit Points')
    expect(container.querySelector('.su-sheet-hero')?.textContent).not.toContain('Hit Points')
    // The longer fields stay in the opening.
    expect(container.querySelector('.su-sheet-hero-fields')?.textContent).toContain('Motto')
  })

  test('on a phone the Vitals stay in the opening', () => {
    viewport(() => false)
    const { container } = sheet()
    const hero = container.querySelector<HTMLElement>('.su-sheet-hero')
    expect(hero?.querySelector('.su-sheet-vitals')?.textContent).toContain('Hit Points')
  })
})
