/**
 * CrawlerSheet — a bay shows its state and folds its prose.
 *
 * Each bay starts folded behind the card's Row ⇄ Card disclosure ("<bay>
 * details"): its crew Token, the line for the crawler's own Tech Level and its
 * roll bar stay in view, and the rest of the bay's rules wait until the reader
 * opens it. Real SRD bays (Pilot Bay, Trading Bay), no patched rows.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Crawler } from 'game-domain/schemas/crawler'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import { CrawlerSheet } from '../CrawlerSheet'

const crawler: Crawler = {
  id: 'crawler-fold-1',
  schemaVersion: 1,
  name: 'Tenacity',
  techLevel: 'tech-3',
  crawlerBays: [{ bayRef: 'pilot-bay' }, { bayRef: 'trading-bay' }],
  systems: [],
  currentSP: 25,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

function store() {
  return makeEntityStoreMock({
    crawlers: [crawler],
    hydrated: { pilots: false, mechs: false, crawlers: true, npcs: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [crawler]),
    get: mock((_type: string, id: string) => (id === crawler.id ? crawler : null)),
    update: mock(async () => crawler),
  })
}

const disclosure = (bay: string) => screen.getByRole('button', { name: `${bay} details` })

/** The Pilot Bay's Tech 3-4 line (Core Book p.224) and its Tech 5-6 line. */
const TL_3_4 = /Allows training of all Core, Advanced, and Hybrid Class Pilot Abilities\./
const TL_5_6 = /Allows training of all Core, Advanced, Hybrid Class, and Legendary/

describe('a crawler bay on the sheet', () => {
  test('starts folded: crew lead, its Tech Level line and the roll bar, no prose', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} />)
    expect(disclosure('Pilot Bay').getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('group', { name: 'Pilot Bay crew lead' })).toBeTruthy()
    expect(screen.getByText(TL_3_4)).toBeTruthy()
    expect(screen.queryByText(TL_5_6)).toBeNull()
    expect(screen.queryByText('Pilot Training Points (TP)')).toBeNull()
    expect(screen.getByRole('button', { name: 'Roll the die on Trading Bay' })).toBeTruthy()
    expect(screen.queryByText('Trading Scrap')).toBeNull()
  })

  test('the disclosure opens the whole of its rules and folds them again', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} />)
    fireEvent.click(disclosure('Pilot Bay'))
    expect(disclosure('Pilot Bay').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(TL_5_6)).toBeTruthy()
    expect(screen.getByText('Pilot Training Points (TP)')).toBeTruthy()
    // Only the bay it names.
    expect(screen.queryByText('Trading Scrap')).toBeNull()
    fireEvent.click(disclosure('Pilot Bay'))
    expect(screen.queryByText('Pilot Training Points (TP)')).toBeNull()
  })

  test('a click inside the bay does not unfold it: only the disclosure does', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Pilot Bay crew name' }))
    expect(screen.getByRole('group', { name: 'Pilot Bay crew lead' })).toBeTruthy()
    expect(disclosure('Pilot Bay').getAttribute('aria-expanded')).toBe('false')
  })

  test('a read-only sheet folds the same way', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} readOnly />)
    expect(screen.queryByText('Pilot Training Points (TP)')).toBeNull()
    fireEvent.click(disclosure('Pilot Bay'))
    expect(screen.getByText('Pilot Training Points (TP)')).toBeTruthy()
  })
})
