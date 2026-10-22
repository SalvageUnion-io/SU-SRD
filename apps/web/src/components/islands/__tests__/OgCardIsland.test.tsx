/**
 * The build-only `/og-card/` surface the screenshot script drives: it reads its
 * entity from the query string, can be swapped in place through
 * `window.__ogSetEntity`, and reports on <html> when data is ready and which
 * entity is committed (or `MISSING:` when the target does not resolve).
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { act, cleanup, render, screen } from '@testing-library/react'
import { OgCardIsland } from '../OgCardIsland'

const html = document.documentElement

afterEach(() => {
  html.removeAttribute('data-og-ready')
  html.removeAttribute('data-og-current')
  window.location.href = 'http://localhost/'
})

function renderAt(query: string) {
  window.location.href = `http://localhost/og-card/${query}`
  return render(<OgCardIsland />)
}

describe('OgCardIsland', () => {
  test('?brand draws the site’s own preview, with the SRD kicker, and needs no entity', () => {
    const { container } = renderAt('?brand')
    expect(container.querySelector('[data-brand-card]')).not.toBeNull()
    expect(screen.getByText('Reference and Character Manager')).toBeTruthy()
    expect(container.querySelector('[data-og-card]')).toBeNull()
  })

  test('draws the card the query names and marks the page ready with that entity', () => {
    const { container } = renderAt('?schema=chassis&item=mule')
    const card = container.querySelector('[data-og-card]')
    expect(card?.getAttribute('aria-label')).toContain('Mule')
    expect(html.hasAttribute('data-og-ready')).toBe(true)
    expect(html.getAttribute('data-og-current')).toBe('chassis/mule')
  })

  test('swaps the entity in place through window.__ogSetEntity, a pattern under its chassis', () => {
    const { container } = renderAt('?schema=chassis&item=mule')
    const swap = window.__ogSetEntity
    if (!swap) throw new Error('no __ogSetEntity hook')

    act(() => swap('chassis', 'mule', 'hauler'))
    expect(html.getAttribute('data-og-current')).toBe('chassis/mule/pattern/hauler')
    expect(container.querySelector('[data-og-card]')?.getAttribute('aria-label')).toContain(
      'Hauler'
    )

    act(() => swap('systems', 'not-a-system'))
    expect(html.getAttribute('data-og-current')).toBe('MISSING:systems/not-a-system')
    expect(container.querySelector('[data-og-card]')).toBeNull()
  })

  test('a pattern that does not resolve reports MISSING rather than falling back to the chassis', () => {
    const { container } = renderAt('?schema=chassis&item=mule&pattern=no-such-pattern')
    expect(html.getAttribute('data-og-current')).toBe(
      'MISSING:chassis/mule/pattern/no-such-pattern'
    )
    expect(container.querySelector('[data-og-card]')).toBeNull()
  })

  test('an unknown schema in the query string draws no card', () => {
    const { container } = renderAt('?schema=not-a-schema&item=mule')
    expect(html.getAttribute('data-og-current')).toBe('MISSING:not-a-schema/mule')
    expect(container.querySelector('[data-og-card]')).toBeNull()
  })

  test('no target draws nothing; unmounting removes the swap hook', () => {
    const { container } = renderAt('')
    expect(container.querySelector('[data-og-card]')).toBeNull()
    expect(typeof window.__ogSetEntity).toBe('function')
    cleanup()
    expect(window.__ogSetEntity).toBeUndefined()
  })
})
