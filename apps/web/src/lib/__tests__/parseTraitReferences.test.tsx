import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { NameRefIndex } from '../../components/index'
import { EntitySurfaceProvider } from '../../components/index'
import { srdHrefFor } from '../entityHref'
import { useParseTraitReferences } from '../parseTraitReferences'

function Prose({ text }: { text: string }) {
  return <p>{useParseTraitReferences(text)}</p>
}

const NAMES: NameRefIndex = {
  dependable: [
    {
      ref: { schemaName: 'traits', id: 'dependable-id', slug: 'dependable', name: 'dependable' },
      noun: 'Trait',
    },
  ],
}

describe('useParseTraitReferences', () => {
  test('plain text passes through untouched', () => {
    render(<Prose text="No references here." />)
    expect(screen.getByText('No references here.')).toBeTruthy()
  })

  test('[[trait]] renders an inert InlineRef mark, not a link or chip', () => {
    // "amphibious" is a real trait in the SRD dataset.
    render(<Prose text="This mech is [[Amphibious]] in water." />)
    const mark = screen.getByText('Amphibious')
    expect(mark.tagName).toBe('SPAN')
    expect(mark.className).toContain('su-inline-ref--inert')
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('[[[Trait] (param)]] renders the name and parameter as one prose mark', () => {
    render(<Prose text="Deals [[[Burn] (2)]] on a hit." />)
    const mark = screen.getByText('Burn (2)')
    expect(mark.tagName).toBe('SPAN')
    expect(mark.className).toContain('su-inline-ref--inert')
  })

  test('an unknown reference still renders as an inert mark', () => {
    render(<Prose text="A [[Phantom Widget]] reference." />)
    const mark = screen.getByText('Phantom Widget')
    expect(mark.tagName).toBe('SPAN')
    expect(mark.className).toContain('su-inline-ref--inert')
  })

  test('a name the surface indexes is a Mention: a link with its Peek, the name alone', () => {
    render(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor, nameRefs: NAMES }}>
        <Prose text="This Chassis gains the Dependable Trait." />
      </EntitySurfaceProvider>
    )
    const link = screen.getByRole('link', { name: 'Dependable' })
    expect(link.getAttribute('href')).toBe('/traits/dependable/')
    expect(link.getAttribute('data-peek')).toBe('traits:dependable-id')
  })

  test('without an index, the same words stay text', () => {
    render(<Prose text="This Chassis gains the Dependable Trait." />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
