/**
 * PEEK CELL: the entity layer's Peek address on a chip, so the Stat atom
 * carries none of its own. A ref adds a wrapper with the address; no ref, or a
 * ref inside a Peek (E16), adds nothing.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { EntityRef } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Stat } from '../../atoms/Stat'
import { PeekCell } from '../parts/PeekCell'
import { InsidePeekContext } from '../peekContext'

const burn = (): EntityRef => {
  const trait = SalvageUnionReference.Traits.getByName('burn')
  if (!trait) throw new Error('Burn fixture missing')
  return toEntityModel(trait).ref
}

const cell = <Stat label="Burn" value="2" />

describe('PeekCell', () => {
  test('wraps the chip in its Peek address', () => {
    const ref = burn()
    const { container } = render(<PeekCell peek={ref}>{cell}</PeekCell>)
    const trigger = container.querySelector('[data-peek]')
    expect(trigger?.getAttribute('data-peek')).toBe(`traits:${ref.id}`)
    expect(trigger?.textContent).toContain('Burn')
  })

  test('adds nothing without a ref', () => {
    const { container } = render(<PeekCell peek={undefined}>{cell}</PeekCell>)
    expect(container.querySelector('[data-peek]')).toBeNull()
  })

  test('adds nothing inside a Peek', () => {
    const { container } = render(
      <InsidePeekContext.Provider value={true}>
        <PeekCell peek={burn()}>{cell}</PeekCell>
      </InsidePeekContext.Provider>
    )
    expect(container.querySelector('[data-peek]')).toBeNull()
  })
})
