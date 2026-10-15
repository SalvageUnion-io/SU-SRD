/**
 * The Armament Bay's Weapons System choice — a schema-only catalog ("pick any
 * Mech System that deals SP damage") — renders under a slab in the card: a
 * "Show options" listing in read-only, a single-select picker when editable.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { ChoiceSelections } from '../../choiceCard/choiceSelectionHelpers'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const armamentBay = () => {
  const bay = SalvageUnionReference.CrawlerBays.getByName('Armament Bay')
  if (!bay) throw new Error('Armament Bay fixture missing')
  return bay
}

describe('Armament Bay — Weapons System catalog listing', () => {
  test('read-only: the prompt as a caption, a slab, and no disclosure triangle', () => {
    const { container } = render(<ReferenceEntityCard data={armamentBay()} />)
    // the choice owns its prompt prose
    expect(screen.getByText(/Choose a Weapons System to mount/i)).toBeTruthy()
    // a slab names the choice; no <details> (no chevron outside Tokens/rows)
    expect(screen.getByText('Armament Bay Weapons System')).toBeTruthy()
    expect(container.querySelector('details')).toBeNull()
    // collapsed: the collection is NOT resolved yet (no system Tokens mounted)
    expect(screen.queryByText('Red Laser')).toBeNull()
  })

  test('"Show options" lists the real Weapons System entities', () => {
    render(<ReferenceEntityCard data={armamentBay()} />)
    const toggle = screen.getByRole('button', { name: 'Show options' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    // a known TL1 weapons system (SP damage) is listed
    expect(screen.getByText('Red Laser')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide options' })).toBeTruthy()
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
