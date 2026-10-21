/**
 * MENTION (E4): an entity named in prose links where the surface routes it,
 * opens the Page where the surface has an opener, and is an inert word where
 * it names nothing. Every resolved Mention carries its Peek's address; a
 * synthetic ref, an unresolved name and anything inside a Peek carry none.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { EntityRef } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { useParseTraitReferences } from '../../../lib/useProseRefs'
import { EntitySurfaceProvider } from '../EntitySurface'
import { Mention } from '../forms/Mention'
import { InsidePeekContext } from '../peekContext'

const burn = (): EntityRef => {
  const trait = SalvageUnionReference.Traits.getByName('burn')
  if (!trait) throw new Error('Burn fixture missing')
  return toEntityModel(trait).ref
}

const hrefFor = (ref: EntityRef) => `/${ref.schemaName}/${ref.slug}/`

describe('Mention', () => {
  test('links to its page where the surface routes it, and carries its Peek', () => {
    const ref = burn()
    render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <Mention entityRef={ref}>Burn (2)</Mention>
      </EntitySurfaceProvider>
    )
    const link = screen.getByRole('link', { name: 'Burn (2)' })
    expect(link.getAttribute('href')).toBe(`/traits/${ref.slug}/`)
    expect(link.getAttribute('data-peek')).toBe(`traits:${ref.id}`)
    expect(link.className).toContain('su-inline-ref--link')
  })

  test('opens the Page where the surface has an opener, and not its host card', () => {
    const ref = burn()
    const openPage = mock((_ref: EntityRef) => {})
    const onCard = mock(() => {})
    render(
      <EntitySurfaceProvider value={{ openPage }}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: a stand-in for a clickable card */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: a stand-in for a clickable card */}
        <div onClick={onCard}>
          <Mention entityRef={ref}>Burn</Mention>
        </div>
      </EntitySurfaceProvider>
    )
    const button = screen.getByRole('button', { name: 'Burn' })
    expect(button.getAttribute('data-peek')).toBe(`traits:${ref.id}`)
    fireEvent.click(button)
    expect(openPage).toHaveBeenCalledTimes(1)
    expect(openPage.mock.calls[0]?.[0]).toEqual(ref)
    expect(onCard).not.toHaveBeenCalled()
  })

  test('an unresolved name is an inert word with no Peek', () => {
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <Mention entityRef={undefined}>Salvage</Mention>
      </EntitySurfaceProvider>
    )
    const word = screen.getByText('Salvage')
    expect(word.tagName).toBe('SPAN')
    expect(word.className).toContain('su-inline-ref--inert')
    expect(container.querySelector('[data-peek]')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('a synthetic ref never links and never Peeks', () => {
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <Mention entityRef={{ ...burn(), synthetic: true }}>Burn</Mention>
      </EntitySurfaceProvider>
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.querySelector('[data-peek]')).toBeNull()
  })

  test('inside a Peek it is inert: no link, no opener, no Peek (E16)', () => {
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor, openPage: () => {} }}>
        <InsidePeekContext.Provider value={true}>
          <Mention entityRef={burn()}>Burn</Mention>
        </InsidePeekContext.Provider>
      </EntitySurfaceProvider>
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('[data-peek]')).toBeNull()
  })
})

function Prose({ text }: { text: string }) {
  return <p>{useParseTraitReferences(text)}</p>
}

describe('rules text', () => {
  test('every [[reference]] is a Mention, never raw markup', () => {
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <Prose text="It gains the [[Vulnerable]] Trait and [[[Burn] (X)]]." />
      </EntitySurfaceProvider>
    )
    expect(container.textContent).toBe('It gains the Vulnerable Trait and Burn (X).')
    expect(screen.getByRole('link', { name: 'Vulnerable' }).getAttribute('href')).toBe(
      '/traits/vulnerable/'
    )
    expect(screen.getByRole('link', { name: 'Burn (X)' })).toBeTruthy()
  })

  test('a keyword resolves when no trait carries the name', () => {
    render(
      <EntitySurfaceProvider value={{ hrefFor }}>
        <Prose text="It counts as [[Irradiated]]." />
      </EntitySurfaceProvider>
    )
    expect(screen.getByRole('link', { name: 'Irradiated' }).getAttribute('data-peek')).toStartWith(
      'keywords:'
    )
  })
})
