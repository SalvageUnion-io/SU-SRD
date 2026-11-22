/**
 * THE ONE LINK RULE (EDL E27): a reference term (a Mention, a Tag) is a real
 * link, and a plain press on it opens its Peek first, with Open page on the
 * plate. A second press, a modified one or the keyboard's Enter follows the
 * link.
 */
import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EntityRef } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { EntitySurfaceProvider } from '../EntitySurface'
import { Mention } from '../forms/Mention'
import { PeekHost } from '../Peek'
import { Tag } from '../parts/Tags'

const burn = (): EntityRef => {
  const trait = SalvageUnionReference.Traits.getByName('Burn')
  if (!trait) throw new Error('Burn fixture missing')
  return toEntityModel(trait).ref
}

const hrefFor = (ref: EntityRef) => `/${ref.schemaName}/${ref.slug}/`

function renderTerm() {
  const ref = burn()
  render(
    <EntitySurfaceProvider value={{ hrefFor }}>
      <p>
        It gains the <Mention entityRef={ref}>Burn</Mention> Trait.
      </p>
      <PeekHost />
    </EntitySurfaceProvider>
  )
  return { ref, link: screen.getByRole('link', { name: 'Burn' }) }
}

/** Press `link`; true where the press was left to follow the link. */
function press(link: HTMLElement, init: MouseEventInit = {}): boolean {
  let followed = true
  act(() => {
    fireEvent.pointerDown(link, { pointerType: 'touch', clientX: 5, clientY: 5 })
    fireEvent.pointerUp(link, { pointerType: 'touch' })
    followed = fireEvent.click(link, init)
  })
  return followed
}

describe('a press on a reference term', () => {
  test('opens its Peek and does not leave the page; the plate offers Open page', async () => {
    const { ref, link } = renderTerm()
    expect(press(link)).toBe(false)
    const peek = await screen.findByRole('tooltip')
    await waitFor(() => expect(peek.querySelector('[data-peek-out]')).not.toBeNull())
    const out = peek.querySelector('[data-peek-out]')
    expect(out?.textContent).toBe('Open page')
    expect(out?.getAttribute('href')).toBe(`/traits/${ref.slug}/`)
    // Focus never moves into a Peek (E16): the term is the keyboard's link.
    expect(out?.getAttribute('tabindex')).toBe('-1')
  })

  test('a second press on the same term follows its link', async () => {
    const { link } = renderTerm()
    expect(press(link)).toBe(false)
    await screen.findByRole('tooltip')
    expect(press(link)).toBe(true)
  })

  test('a modified press (a new tab) follows the link at once', () => {
    const { link } = renderTerm()
    expect(press(link, { ctrlKey: true })).toBe(true)
    expect(press(link, { metaKey: true })).toBe(true)
  })

  test("the keyboard's Enter follows the link: focus had already opened the Peek", async () => {
    const { link } = renderTerm()
    act(() => link.focus())
    await screen.findByRole('tooltip')
    let followed = false
    act(() => {
      followed = fireEvent.click(link, { detail: 0 })
    })
    expect(followed).toBe(true)
  })

  test('a linked Tag is a term too', async () => {
    const ref = burn()
    render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <Tag tag={{ key: 'burn', name: 'Burn', param: '2', ref }} linkable />
        <PeekHost />
      </EntitySurfaceProvider>
    )
    const chip = screen.getByRole('link', { name: 'Burn: 2' })
    expect(press(chip)).toBe(false)
    const peek = await screen.findByRole('tooltip')
    await waitFor(() => expect(peek.querySelector('[data-peek-out]')).not.toBeNull())
  })

  test('on a phone the Peek is a sheet at the foot of the screen, Open page pinned under its card', async () => {
    const real = window.matchMedia
    // Below the ladder's first rung: no `(width >= …)` query matches.
    window.matchMedia = ((query: string) =>
      ({ matches: false, media: query }) as MediaQueryList) as typeof window.matchMedia
    try {
      const { link } = renderTerm()
      expect(press(link)).toBe(false)
      const peek = await screen.findByRole('tooltip')
      expect(peek.hasAttribute('data-peek-sheet')).toBe(true)
      expect(peek.style.position).toBe('fixed')
      expect(peek.style.bottom).toBe('0px')
      expect(peek.style.maxHeight).toBe('80dvh')
      await waitFor(() => expect(peek.querySelector('[data-peek-out]')).not.toBeNull())
      // The card scrolls; the way out is its sibling, outside the scroll.
      const out = peek.querySelector('[data-peek-out]')?.parentElement
      const card = out?.previousElementSibling as HTMLElement
      expect(card.style.overflowY).toBe('auto')
      expect(card.contains(out ?? null)).toBe(false)
      expect(out?.parentElement).toBe(peek)
      // A visible Close heads the sheet, outside the scroll (r3 C3): Back and
      // a press outside are ways out the sheet itself never shows.
      const close = within(peek).getByRole('button', { name: 'Close' })
      expect(card.contains(close)).toBe(false)
      fireEvent.click(close)
      await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    } finally {
      window.matchMedia = real
    }
  })
})
