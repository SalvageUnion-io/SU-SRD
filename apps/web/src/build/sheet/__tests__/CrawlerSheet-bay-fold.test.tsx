/**
 * CrawlerSheet — a bay reads as Bay Info, its crew, When Damaged.
 *
 * On a sheet both folding sections start shut: the crew Token and the roll
 * bar stay in view, and the bay's rules and its damaged clause wait until the
 * reader opens them. A damaged bay opens its When Damaged. Real SRD bays
 * (Pilot Bay, Trading Bay), no patched rows.
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

/** A section's fold, named for its bay ("Expand Pilot Bay Bay Info"). */
const fold = (bay: string, section: string) =>
  screen.getByRole('button', { name: new RegExp(`^(Expand|Collapse) ${bay} ${section}$`) })

/** Shown: in the document and under no shut fold. */
function shown(text: string | RegExp): boolean {
  const node = screen.queryByText(text)
  return node !== null && node.closest('[hidden]') === null
}

const TRAINING = 'Pilot Training Points (TP)'
const PILOT_DAMAGED = /If the Pilot Bay is damaged, you cannot train/

describe('a crawler bay on the sheet', () => {
  test('starts with Bay Info and When Damaged shut: crew lead and roll bar in view', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} />)
    expect(fold('Pilot Bay', 'Bay Info').getAttribute('aria-expanded')).toBe('false')
    expect(fold('Pilot Bay', 'When Damaged').getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('group', { name: 'Pilot Bay crew lead' })).toBeTruthy()
    expect(shown(TRAINING)).toBe(false)
    expect(shown(PILOT_DAMAGED)).toBe(false)
    expect(screen.getByRole('button', { name: 'Roll the die on Trading Bay' })).toBeTruthy()
    expect(shown('Trading Scrap')).toBe(false)
  })

  test('Bay Info leads, then the crew, then When Damaged', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} />)
    const info = fold('Pilot Bay', 'Bay Info')
    const crew = screen.getByRole('group', { name: 'Pilot Bay crew lead' })
    const damaged = fold('Pilot Bay', 'When Damaged')
    expect(info.compareDocumentPosition(crew) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(crew.compareDocumentPosition(damaged) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('each fold opens its own section of its own bay, and shuts it again', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} />)
    fireEvent.click(fold('Pilot Bay', 'Bay Info'))
    expect(fold('Pilot Bay', 'Bay Info').getAttribute('aria-expanded')).toBe('true')
    expect(shown(TRAINING)).toBe(true)
    expect(shown('Trading Scrap')).toBe(false)
    expect(shown(PILOT_DAMAGED)).toBe(false)
    fireEvent.click(fold('Pilot Bay', 'When Damaged'))
    expect(shown(PILOT_DAMAGED)).toBe(true)
    fireEvent.click(fold('Pilot Bay', 'Bay Info'))
    expect(shown(TRAINING)).toBe(false)
  })

  test('a click inside the bay does not unfold it: only the fold does', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit pilot bay crew name' }))
    expect(screen.getByRole('group', { name: 'Pilot Bay crew lead' })).toBeTruthy()
    expect(fold('Pilot Bay', 'Bay Info').getAttribute('aria-expanded')).toBe('false')
  })

  test('a damaged bay opens its When Damaged', () => {
    const damaged: Crawler = {
      ...crawler,
      crawlerBays: [{ bayRef: 'pilot-bay', condition: 'damaged' }],
    }
    render(<CrawlerSheet crawler={damaged} store={store()} />)
    expect(fold('Pilot Bay', 'When Damaged').getAttribute('aria-expanded')).toBe('true')
    expect(shown(PILOT_DAMAGED)).toBe(true)
    expect(fold('Pilot Bay', 'Bay Info').getAttribute('aria-expanded')).toBe('false')
  })

  test('a read-only sheet folds the same way', () => {
    render(<CrawlerSheet crawler={crawler} store={store()} readOnly />)
    expect(shown(TRAINING)).toBe(false)
    fireEvent.click(fold('Pilot Bay', 'Bay Info'))
    expect(shown(TRAINING)).toBe(true)
  })
})
