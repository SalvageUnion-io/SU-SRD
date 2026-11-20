import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { NeighbourRow } from '../NeighbourRow'

const traits = SalvageUnionReference.findAllIn('traits', () => true) as RefMetaEntity[]
const [first, second] = traits as [RefMetaEntity, RefMetaEntity]

describe('NeighbourRow', () => {
  test('each side is its cut-out alone, the relation and the name; the forward side at its end', () => {
    const { container } = render(
      <NeighbourRow
        as="h2"
        neighbours={[
          { label: 'Previous', entities: [first] },
          { label: 'Next', entities: [second], end: true },
        ]}
      />
    )
    const previous = screen.getByRole('heading', { name: new RegExp(`^Previous:.${first.name}$`) })
    expect(previous).toBeTruthy()
    expect(screen.getByRole('heading', { name: new RegExp(`^Next:.${second.name}$`) })).toBeTruthy()
    // No body under either cut-out.
    expect(container.querySelector('.su-slab-section__body')).toBeNull()
    expect(container.querySelectorAll('.su-entity-page__section--end')).toHaveLength(1)
  })

  test('a side with several names lists them; an empty side is not drawn, and a row with none is nothing', () => {
    const { container, rerender } = render(
      <NeighbourRow
        neighbours={[
          { label: 'Previous', entities: [] },
          { label: 'Next', entities: [first, second], end: true },
        ]}
      />
    )
    expect(screen.queryByText(/Previous/)).toBeNull()
    expect(container.textContent).toContain(`${first.name}, ${second.name}`)
    rerender(<NeighbourRow neighbours={[{ label: 'Previous', entities: [] }]} />)
    expect(container.innerHTML).toBe('')
  })
})
