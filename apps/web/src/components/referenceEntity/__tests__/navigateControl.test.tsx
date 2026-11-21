/**
 * `navigateControl`, the card's one control preset: it makes the whole card
 * the way in (one named button, keyboard and pointer alike) and draws no
 * control of its own in the card's chip group.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../card/ReferenceEntityCard'
import { navigateControl } from '../referenceEntityControls'

describe('navigateControl', () => {
  test('the card itself opens it; no separate control is drawn', () => {
    const hauler = SalvageUnionReference.Classes.getByName('Hauler')
    if (!hauler) throw new Error('fixture missing: Hauler')
    const open = mock(() => undefined)
    render(
      <ReferenceEntityCard
        data={hauler}
        size="compact"
        controls={[navigateControl(open)]}
        cardClickLabel="Hauler"
      />
    )
    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull()
    const card = screen.getByRole('button', { name: 'Hauler' })
    expect(card.tabIndex).toBe(0)
    fireEvent.click(card)
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(open).toHaveBeenCalledTimes(2)
  })
})
