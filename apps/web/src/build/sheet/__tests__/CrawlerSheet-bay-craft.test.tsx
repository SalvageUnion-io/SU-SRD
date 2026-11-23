/**
 * The Crafting Bay crafts from the crawler sheet (r7 D7, SB7-16): opened, its
 * line has Craft, which opens the craft panel Play's Downtime uses. A Damaged
 * bay, or a sheet the viewer may not write, has none.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Crawler } from 'game-domain/schemas/crawler'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { CrawlerSheet } from '../CrawlerSheet'

const crawler = (condition: 'intact' | 'damaged' = 'intact'): Crawler => ({
  id: 'crawler-craft-1',
  schemaVersion: 1,
  name: 'Calypso',
  techLevel: 2,
  crawlerBays: [{ bayRef: 'crafting-bay', condition }],
  systems: [],
  currentSP: 25,
  scrapPool: { tl2: 8 },
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
})

const openBay = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Crafting Bay rules and crew' }))

describe('the Crafting Bay on the crawler sheet', () => {
  test('Read, writable: Craft opens the craft panel', async () => {
    const unit = crawler()
    render(
      <CrawlerSheet
        crawler={unit}
        store={makeSingleUnitStore('crawler', unit)}
        readOnly
        liveCondition
      />
    )
    openBay()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Craft' }))
    })
    expect(
      await screen.findByRole('searchbox', { name: 'Find a System or Module to craft' })
    ).toBeTruthy()
  })

  test('a Damaged bay, or a sheet only read, has no Craft', () => {
    const damaged = crawler('damaged')
    const { unmount } = render(
      <CrawlerSheet
        crawler={damaged}
        store={makeSingleUnitStore('crawler', damaged)}
        readOnly
        liveCondition
      />
    )
    openBay()
    expect(screen.queryByRole('button', { name: 'Craft' })).toBeNull()
    unmount()
    const unit = crawler()
    render(<CrawlerSheet crawler={unit} store={makeSingleUnitStore('crawler', unit)} readOnly />)
    openBay()
    expect(screen.queryByRole('button', { name: 'Craft' })).toBeNull()
  })
})
