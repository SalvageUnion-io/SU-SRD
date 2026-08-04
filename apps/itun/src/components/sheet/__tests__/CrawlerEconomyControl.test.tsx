/**
 * CrawlerEconomyControl — crawler economy action tests (design-review R-4).
 *
 * ADR-007 coverage:
 *   1. Pay Upkeep auto-draws 5× TL Scrap from the pool and credits the
 *      Upgrade Pool in full (p.218).
 *   2. A short pool offers the Deterioration roll instead; the "chosen at
 *      random" Bay damage and SP loss auto-apply, while the 6-10 band only
 *      advises the player to pick a Bay.
 *   3. Upgrade consumes the Upgrade Pool, bumps the Tech Level, and repairs
 *      damaged Bays (p.219); an underfunded pool disables the confirm.
 *   4. The Scrap exchange trades at fixed equal-value rates (p.223).
 *   5. A Damaged Trading Bay blocks trading and the availability roll.
 *
 * Uses the store-injection seam, REAL reference data (crawler-bays +
 * crawler-tech-levels) and an injectable d20 — same pattern as
 * SalvageControl.test.tsx. NO mock.module().
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { CrawlerEconomyControl } from '../CrawlerEconomyControl'
import type { Roll } from '../../../lib/rules/heatCheck'
import type { Crawler } from '../../../lib/schemas/crawler'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { LIVE_SHEET_TXN } from '../../../stores/surfaceProvenance'
import type { ChangeMeta } from '../../../stores/entityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload(['crawler-bays', 'crawler-tech-levels'])
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCrawler(overrides: Partial<Crawler> = {}): Crawler {
  return {
    id: 'crawler-econ-1',
    schemaVersion: 1,
    name: 'Iron Tortoise',
    techLevel: 'tech-2',
    systems: [],
    crawlerBays: [{ bayRef: 'Trading Bay' }, { bayRef: 'Med Bay' }],
    scrapPool: { tl2: 6 },
    upgradePool: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

type BayPatch = Partial<NonNullable<Crawler['crawlerBays']>[number]>

function makeStubStore(crawler: Crawler) {
  const update = mock<
    (type: string, id: string, patch: Partial<Crawler>, meta?: ChangeMeta) => Promise<Crawler>
  >(async () => crawler)
  const updateCrawlerBay = mock<
    (
      id: string,
      bayRef: string,
      patch: BayPatch,
      index?: number,
      meta?: ChangeMeta
    ) => Promise<Crawler>
  >(async () => crawler)
  const store = makeEntityStoreMock({
    crawlers: [crawler],
    hydrated: { pilots: false, mechs: false, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [crawler]),
    get: mock((_type: string, id: string) => (id === crawler.id ? crawler : null)),
    create: mock(async () => crawler),
    update,
    updateCrawlerBay,
    delete: mock(async () => {}),
  })
  return {
    store,
    update,
    updateCrawlerBay,
  }
}

/** Returns a Roll that yields the given values in order, ignoring `sides`. */
function seqRoll(...values: number[]): Roll {
  let i = 0
  return () => {
    const v = values[i] ?? values[values.length - 1] ?? 1
    i++
    return v
  }
}

// ---------------------------------------------------------------------------
// Pay Upkeep (p.218)
// ---------------------------------------------------------------------------

describe('CrawlerEconomyControl — Pay Upkeep', () => {
  test('paying draws 5× TL scrap and credits the Upgrade Pool', async () => {
    const crawler = makeCrawler()
    const { store, update } = makeStubStore(crawler)
    render(
      <CrawlerEconomyControl
        crawler={crawler}
        store={store}
        open="upkeep"
        onClose={() => {}}
        roll={seqRoll(1)}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pay Upkeep' }))
    await screen.findByRole('status')

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]).toEqual([
      'crawler',
      crawler.id,
      { scrapPool: { tl2: 1 }, upgradePool: 15 },
      LIVE_SHEET_TXN,
    ])
    expect(screen.getByRole('status').textContent).toContain('Upgrade Pool now 15 of 30')
  })

  test('a short pool warns and offers the Deterioration roll; random-Bay damage auto-applies', async () => {
    const crawler = makeCrawler({ scrapPool: { tl2: 3 }, currentSP: 10 })
    const { store, update, updateCrawlerBay } = makeStubStore(crawler)
    // Table d20 = 4 (random-bay band), then roll(2 bays) = 2 → index 1 (Med Bay).
    render(
      <CrawlerEconomyControl
        crawler={crawler}
        store={store}
        open="upkeep"
        onClose={() => {}}
        roll={seqRoll(4, 2)}
      />
    )

    expect(screen.queryByRole('button', { name: 'Pay Upkeep' })).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('2 scrap short')

    fireEvent.click(screen.getByRole('button', { name: 'Roll Deterioration (d20)' }))
    await screen.findByRole('status')

    expect(update).not.toHaveBeenCalled() // no SP loss on 2-5
    expect(updateCrawlerBay).toHaveBeenCalledTimes(1)
    expect(updateCrawlerBay.mock.calls[0]).toEqual([
      crawler.id,
      'Med Bay',
      { condition: 'damaged' },
      1,
      LIVE_SHEET_TXN,
    ])
    expect(screen.getByRole('status').textContent).toContain('Med Bay is Damaged')
  })

  test('the 11-19 band auto-applies the 5 SP loss', async () => {
    const crawler = makeCrawler({ scrapPool: {}, currentSP: 10 })
    const { store, update, updateCrawlerBay } = makeStubStore(crawler)
    render(
      <CrawlerEconomyControl
        crawler={crawler}
        store={store}
        open="upkeep"
        onClose={() => {}}
        roll={seqRoll(15)}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Roll Deterioration (d20)' }))
    await screen.findByRole('status')

    expect(update.mock.calls[0]).toEqual(['crawler', crawler.id, { currentSP: 5 }, LIVE_SHEET_TXN])
    expect(updateCrawlerBay).not.toHaveBeenCalled()
  })

  test('the 6-10 band only advises the player to choose a Bay (ADR-007)', async () => {
    const crawler = makeCrawler({ scrapPool: {}, currentSP: 10 })
    const { store, update, updateCrawlerBay } = makeStubStore(crawler)
    render(
      <CrawlerEconomyControl
        crawler={crawler}
        store={store}
        open="upkeep"
        onClose={() => {}}
        roll={seqRoll(7)}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Roll Deterioration (d20)' }))
    await screen.findByText(/Choose a Bay and mark it Damaged/)

    expect(update).not.toHaveBeenCalled()
    expect(updateCrawlerBay).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Upgrade Crawler (p.218-219)
// ---------------------------------------------------------------------------

describe('CrawlerEconomyControl — Upgrade Crawler', () => {
  test('upgrading consumes the pool, bumps the TL and repairs damaged Bays', async () => {
    const crawler = makeCrawler({
      upgradePool: 32,
      crawlerBays: [{ bayRef: 'Trading Bay', condition: 'damaged' }, { bayRef: 'Med Bay' }],
    })
    const { store, update } = makeStubStore(crawler)
    const onClose = mock(() => {})
    render(
      <CrawlerEconomyControl crawler={crawler} store={store} open="upgrade" onClose={onClose} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Tech 3' }))
    await Promise.resolve()

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]).toEqual([
      'crawler',
      crawler.id,
      {
        techLevel: 'tech-3',
        upgradePool: 2,
        crawlerBays: [
          { bayRef: 'Trading Bay', condition: 'intact' },
          { bayRef: 'Med Bay', condition: 'intact' },
        ],
      },
      LIVE_SHEET_TXN,
    ])
    expect(onClose).toHaveBeenCalled()
  })

  test('an underfunded Upgrade Pool disables the confirm', () => {
    const crawler = makeCrawler({ upgradePool: 10 })
    const { store } = makeStubStore(crawler)
    render(
      <CrawlerEconomyControl crawler={crawler} store={store} open="upgrade" onClose={() => {}} />
    )

    const confirm = screen.getByRole('button', { name: 'Upgrade to Tech 3' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toContain('20 short')
  })

  test('contributing moves pool scrap into the Upgrade Pool', async () => {
    const crawler = makeCrawler({ upgradePool: 10, scrapPool: { tl2: 6 } })
    const { store, update } = makeStubStore(crawler)
    render(
      <CrawlerEconomyControl crawler={crawler} store={store} open="upgrade" onClose={() => {}} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add to Upgrade Pool' }))
    await Promise.resolve()

    expect(update.mock.calls[0]).toEqual([
      'crawler',
      crawler.id,
      { scrapPool: { tl2: 5 }, upgradePool: 11 },
      LIVE_SHEET_TXN,
    ])
  })
})

// ---------------------------------------------------------------------------
// Trading Bay (p.223)
// ---------------------------------------------------------------------------

describe('CrawlerEconomyControl — Trading Bay', () => {
  test('trades scrap at the fixed equal-value rate (4× T1 → 1× T4)', async () => {
    const crawler = makeCrawler({ scrapPool: { tl1: 5 } })
    const { store, update } = makeStubStore(crawler)
    render(
      <CrawlerEconomyControl crawler={crawler} store={store} open="trade" onClose={() => {}} />
    )

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '4' } })
    expect(screen.getByTestId('trade-preview').textContent).toBe('4× T1 → 1× T4')

    fireEvent.click(screen.getByRole('button', { name: 'Trade' }))
    await screen.findByRole('status')

    expect(update.mock.calls[0]).toEqual([
      'crawler',
      crawler.id,
      { scrapPool: { tl1: 1, tl4: 1 } },
      LIVE_SHEET_TXN,
    ])
  })

  test('the availability roll reports the band and the TL+1 source', async () => {
    const crawler = makeCrawler()
    const { store, update } = makeStubStore(crawler)
    render(
      <CrawlerEconomyControl
        crawler={crawler}
        store={store}
        open="trade"
        onClose={() => {}}
        roll={seqRoll(20)}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Roll Availability (d20)' }))
    const status = await screen.findByRole('status')

    expect(status.textContent).toContain('Rolled 20')
    expect(status.textContent).toContain('An Intact Mech Chassis is available for trade.')
    expect(status.textContent).toContain('(Tech 3)')
    expect(update).not.toHaveBeenCalled() // informational — buying stays manual
  })

  test('a Damaged Trading Bay blocks both trading and the roll', () => {
    const crawler = makeCrawler({
      crawlerBays: [{ bayRef: 'Trading Bay', condition: 'damaged' }, { bayRef: 'Med Bay' }],
    })
    const { store } = makeStubStore(crawler)
    render(
      <CrawlerEconomyControl crawler={crawler} store={store} open="trade" onClose={() => {}} />
    )

    expect(screen.getByRole('alert').textContent).toContain('Trading Bay is Damaged')
    expect(screen.queryByRole('button', { name: 'Trade' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Roll Availability (d20)' })).toBeNull()
  })
})
