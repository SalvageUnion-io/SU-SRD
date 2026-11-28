/**
 * The picker searches by trait (r5 E2): the Traits facet lists every trait
 * the shown parts carry, their attack's as well as their own, and a trait's
 * name typed in the field finds every part with it.
 */

import { describe, expect, it } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { carriedTraits } from '../searcherFacts'
import { useSearcherPool } from '../useSearcherPool'

const idOf = (item: { id: string }) => item.id

function systemsPool() {
  return renderHook(() =>
    useSearcherPool({
      schema: 'systems',
      selected: [],
      idOf,
      browse: false,
      chosenLabel: 'Systems',
    })
  )
}

describe('the picker searches by trait (r5 E2)', () => {
  it("lists a weapon's traits in the Traits facet, not the entry's own alone", () => {
    const { result } = systemsPool()
    const row = result.current.facetRows.find((facet) => facet.label === 'Traits')
    const labels = row?.chips.map((chip) => chip.label) ?? []
    for (const trait of ['Melee', 'Ballistic', 'Energy', 'Hot']) expect(labels).toContain(trait)
  })

  it('a trait name typed finds every part that carries it', () => {
    const { result } = systemsPool()
    const carriers = result.current.pool.filter((item) => carriedTraits(item).includes('Melee'))
    expect(carriers.map((item) => item.name)).toContain('Mining Rig')
    act(() => result.current.setQuery('melee'))
    const found = new Set(result.current.visible.map((item) => item.id))
    for (const item of carriers) expect(found.has(item.id)).toBe(true)
  })

  it('a Traits chip keeps the parts whose attack carries the trait', () => {
    const { result } = systemsPool()
    const chip = result.current.facetRows
      .find((facet) => facet.label === 'Traits')
      ?.chips.find((entry) => entry.label === 'Melee')
    act(() => chip?.onClick())
    expect(result.current.visible.map((item) => item.name)).toContain('Mining Rig')
    expect(result.current.visible.every((item) => carriedTraits(item).includes('Melee'))).toBe(true)
  })
})
