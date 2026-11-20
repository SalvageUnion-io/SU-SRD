import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { NeighbourRow } from '../NeighbourRow'

const traits = SalvageUnionReference.findAllIn('traits', () => true) as RefMetaEntity[]
const [first, second] = traits as [RefMetaEntity, RefMetaEntity]

describe('NeighbourRow', () => {
  test('draws each side that has a neighbour, the forward side’s name at its end', () => {
    const { container } = render(
      <NeighbourRow
        as="h2"
        neighbours={[
          { label: 'Previous', entities: [first] },
          { label: 'Next', entities: [second], end: true },
        ]}
      />
    )
    expect(screen.getByRole('heading', { name: 'Previous' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Next' })).toBeTruthy()
    expect(container.querySelectorAll('.su-entity-page__section--end')).toHaveLength(1)
    expect(screen.getByText(second.name, { exact: false })).toBeTruthy()
  })

  test('an empty side is not drawn, and a row with none is nothing', () => {
    const { container, rerender } = render(
      <NeighbourRow
        neighbours={[
          { label: 'Previous', entities: [] },
          { label: 'Next', entities: [first], end: true },
        ]}
      />
    )
    expect(screen.queryByText('Previous')).toBeNull()
    rerender(<NeighbourRow neighbours={[{ label: 'Previous', entities: [] }]} />)
    expect(container.innerHTML).toBe('')
  })
})
