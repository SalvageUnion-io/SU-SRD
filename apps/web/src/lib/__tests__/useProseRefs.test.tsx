import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { NameRefIndex } from '../../components/index'
import { EntitySurfaceProvider } from '../../components/index'
import { ProseSection } from '../../components/ProseSection'
import { srdHrefFor } from '../entityHref'
import { useParseTraitReferences } from '../useProseRefs'

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
  test('in a section a term links at its first mention alone, a page reference every time (RR2-15)', () => {
    const { container, rerender } = render(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor, nameRefs: NAMES }}>
        <ProseSection>
          <Prose text="It gains the Dependable Trait." />
          <Prose text="A Dependable Trait holds, and the Dependable Trait again." />
        </ProseSection>
        <ProseSection>
          <Prose text="Another section's Dependable Trait." />
        </ProseSection>
      </EntitySurfaceProvider>
    )
    const paragraphs = () =>
      [...container.querySelectorAll('p')].map((p) => p.querySelectorAll('a').length)
    expect(paragraphs()).toEqual([1, 0, 1])
    expect(container.querySelectorAll('p')[1]?.textContent).toBe(
      'A Dependable Trait holds, and the Dependable Trait again.'
    )
    // A second render keeps the link where it was: the first run holds its claim.
    rerender(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor, nameRefs: { ...NAMES } }}>
        <ProseSection>
          <Prose text="It gains the Dependable Trait." />
          <Prose text="A Dependable Trait holds, and the Dependable Trait again." />
        </ProseSection>
        <ProseSection>
          <Prose text="Another section's Dependable Trait." />
        </ProseSection>
      </EntitySurfaceProvider>
    )
    expect(paragraphs()).toEqual([1, 0, 1])
  })

  test("a page reference to what its paragraph just linked is that link's citation: one link (RR7-16)", () => {
    const ref = {
      schemaName: 'crawler-bays' as const,
      id: 'pilot-bay-id',
      slug: 'pilot-bay',
      name: 'Pilot Bay',
    }
    const { container } = render(
      <EntitySurfaceProvider
        value={{
          hrefFor: srdHrefFor,
          nameRefs: { 'pilot bay': [{ ref, noun: 'Bay' }] },
          pageRefs: { 223: [{ ref, noun: 'crawler bay', guide: true }] },
        }}
      >
        <Prose text="Full details on the Pilot Bay can be found on p. 223." />
        <Prose text="See p. 223." />
      </EntitySurfaceProvider>
    )
    const [first, second] = [...container.querySelectorAll('p')]
    expect([...(first?.querySelectorAll('a') ?? [])].map((a) => a.textContent)).toEqual([
      'Pilot Bay',
    ])
    expect(first?.textContent).toContain('on p. 223.')
    // Alone, the citation links.
    expect(second?.querySelector('a')?.textContent).toBe('p. 223')
  })

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

  test('within one paragraph only the first link to a term is a Tab stop (r4 F9)', () => {
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor }}>
        <Prose
          text={'It is [[Hot]] and [[[Hot] (3)]], then [[Burn]].\n\nA new paragraph: [[Hot]].'}
        />
      </EntitySurfaceProvider>
    )
    const links = [...container.querySelectorAll('a')]
    // Every mention is still a link a pointer can follow.
    expect(links.map((a) => a.textContent)).toEqual(['Hot', 'Hot (3)', 'Burn', 'Hot'])
    // The keyboard stops once a term a paragraph.
    expect(links.map((a) => a.getAttribute('tabindex'))).toEqual([null, '-1', null, null])
  })
})

describe('the book’s italics (r5 E13)', () => {
  test('a *sentence* prints in italics without its asterisks, and a term inside it still links', () => {
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor, nameRefs: NAMES }}>
        <Prose text="It cuts rock. *Regulation requires the Dependable Trait when firing.*" />
      </EntitySurfaceProvider>
    )
    const p = container.querySelector('p')
    expect(p?.textContent).toBe(
      'It cuts rock. Regulation requires the Dependable Trait when firing.'
    )
    const ems = [...container.querySelectorAll('em')]
    expect(ems.map((e) => e.textContent).join('')).toBe(
      'Regulation requires the Dependable Trait when firing.'
    )
    expect(container.querySelector('em a')?.textContent).toContain('Dependable')
  })

  test('plain text with italics alone, and **bold** is left as it is', () => {
    const { container } = render(
      <Prose text="we really do mean *everything*. Any **Mutant** too." />
    )
    expect(container.querySelector('em')?.textContent).toBe('everything')
    expect(container.querySelector('p')?.textContent).toBe(
      'we really do mean everything. Any **Mutant** too.'
    )
  })
})
