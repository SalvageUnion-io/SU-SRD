/**
 * The Armament Bay's Weapons System choice — a schema-only catalog ("pick any
 * Mech System that deals SP damage") — renders as an expandable entity listing
 * in the card, static in read-only and a single-select picker when editable.
 */
import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { ChoiceSelections } from '../../choiceCard/choiceSelectionHelpers'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const armamentBay = () => {
  const bay = SalvageUnionReference.CrawlerBays.all().find((b) => b.name === 'Armament Bay')
  if (!bay) throw new Error('Armament Bay fixture missing')
  return bay
}

afterEach(cleanup)

describe('Armament Bay — Weapons System catalog listing', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

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

  test('editable: clicking a system reports it as the selection', () => {
    const calls: ChoiceSelections[] = []
    render(
      <ReferenceEntityCard
        data={armamentBay()}
        selections={{}}
        onSelectionChange={(next) => calls.push(next)}
      />
    )
    fireEvent.click(screen.getByText('Armament Bay Weapons System'))
    fireEvent.click(screen.getByText('Red Laser'))
    expect(calls.length).toBe(1)
    const values = Object.values(calls[0] ?? {}).flat()
    expect(values).toContain('Red Laser')
  })
})
