/**
 * CrawlerSheet, read: the dash for a crawler with a type, a weapon, a hold and
 * exotic scrap. Its weapons read as a table, its type's abilities in full with
 * the type's crew lead, its stored lots and exotic resources under Storage,
 * and what was written about it beside its numbers.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { makeUnitLot } from 'game-domain/schemas/cargoLot'
import { crawlerFixture } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { CrawlerSheet } from '../CrawlerSheet'

const crawler = crawlerFixture({
  id: 'crawler-read-1',
  name: 'Tenacity',
  techLevel: 2,
  type: 'battle',
  typeNpc: { npcName: 'Old Brann' },
  bayChoices: {},
  systems: ['120mm-cannon'],
  description: 'Patched hull, proud crew.',
  scrapPool: { tl1: 4, chimerium: 2 },
  cargoLots: [makeUnitLot('Sealed Crate', { units: 1 })],
  crawlerBays: [{ bayRef: 'pilot-bay' }],
})

describe('CrawlerSheet, read', () => {
  test('weapons, the type, the hold and the description each have their place', () => {
    render(
      <CrawlerSheet crawler={crawler} store={makeSingleUnitStore('crawler', crawler)} readOnly />
    )

    const weapons = screen.getByRole('table', { name: /Weapons/ })
    expect(within(weapons).getByText(/120mm Cannon/)).toBeTruthy()

    expect(screen.getAllByText(/Battle/).length).toBeGreaterThan(0)
    const typeCrew = screen.getByRole('table', { name: /crew/i })
    expect(within(typeCrew).getByText('Old Brann')).toBeTruthy()

    const stored = screen.getByRole('table', { name: /Stored/ })
    expect(within(stored).getByText('Sealed Crate')).toBeTruthy()
    expect(screen.getAllByText(/Chimerium/).length).toBeGreaterThan(0)

    expect(screen.getByText('Patched hull, proud crew.')).toBeTruthy()
  })
})
