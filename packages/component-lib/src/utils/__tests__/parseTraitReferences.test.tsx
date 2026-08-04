import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { useParseTraitReferences } from '../parseTraitReferences'

function Prose({ text }: { text: string }) {
  return <p>{useParseTraitReferences(text)}</p>
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
    expect(mark.className).toContain('border-dashed')
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('[[[Trait] (param)]] renders the name and parameter as one prose mark', () => {
    render(<Prose text="Deals [[[Burn] (2)]] on a hit." />)
    const mark = screen.getByText('Burn (2)')
    expect(mark.tagName).toBe('SPAN')
    expect(mark.className).toContain('border-dashed')
  })

  test('an unknown reference still renders as an inert mark', () => {
    render(<Prose text="A [[Phantom Widget]] reference." />)
    const mark = screen.getByText('Phantom Widget')
    expect(mark.tagName).toBe('SPAN')
    expect(mark.className).toContain('border-dashed')
  })
})
