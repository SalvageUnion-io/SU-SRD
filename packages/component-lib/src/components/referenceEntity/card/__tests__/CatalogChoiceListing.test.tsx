/**
 * The Armament Bay's Weapons System choice — a schema-only catalog ("pick any
 * Mech System that deals SP damage") — renders as an expandable entity listing
 * in the card, static in read-only and a single-select picker when editable.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { ChoiceSelections } from '../../choiceCard/choiceSelectionHelpers'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const armamentBay = () => {
  const bay = SalvageUnionReference.CrawlerBays.all().find((b) => b.name === 'Armament Bay')
  if (!bay) throw new Error('Armament Bay fixture missing')
  return bay
}

describe('Armament Bay — Weapons System catalog listing', () => {
  test('read-only: shows the choice prompt + a collapsed listing summary', () => {
    render(<ReferenceEntityCard data={armamentBay()} />)
    // the choice owns its prompt prose
    expect(screen.getByText(/Choose a Weapons System to mount/i)).toBeTruthy()
    // the collapsed listing summary names the choice
    expect(screen.getByText('Armament Bay Weapons System')).toBeTruthy()
    // collapsed: the collection is NOT resolved yet (no system cards mounted)
    expect(screen.queryByText('Red Laser')).toBeNull()
  })

  test('expanding the listing reveals real Weapons System entity cards', () => {
    render(<ReferenceEntityCard data={armamentBay()} />)
    fireEvent.click(screen.getByText('Armament Bay Weapons System'))
    // a known TL1 weapons system (SP damage) is listed
    expect(screen.getByText('Red Laser')).toBeTruthy()
  })

  test('editable: a Choose button launches the picker modal', () => {
    const calls: ChoiceSelections[] = []
    render(
      <ReferenceEntityCard
        data={armamentBay()}
        selections={{}}
        onSelectionChange={(next) => calls.push(next)}
      />
    )
    // editable shows a launcher button, not the inline read-only listing
    const launch = screen.getByRole('button', {
      name: /Choose Armament Bay Weapons System/i,
    })
    fireEvent.click(launch)
    // the modal (EntitySearcher) opens: its search field + the weapons pool appear
    expect(screen.getByLabelText('Search')).toBeTruthy()
    expect(screen.getByText('Red Laser')).toBeTruthy()
  })
})
