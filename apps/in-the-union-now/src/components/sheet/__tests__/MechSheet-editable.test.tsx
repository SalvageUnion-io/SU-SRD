/**
 * MechSheet — per-item action economy (plan 4.5, S12).
 *
 * Stat editing moved to the hero trackers (Sheet.tsx); the body's edit
 * surface is the per-card action economy:
 *   - Use spends the primary action's EP cost (and ticks the uses counter).
 *   - Damaged DISABLES Use and promotes Repair to primary, showing the
 *     half-SV scrap cost.
 *   - Repair flips the item to Intact; the crawler scrap-pool deduction is
 *     optional and never blocks (S12) — both paths covered.
 *   - Uses steppers persist per-item counters for systems AND modules.
 *   - Chassis ability Use spends EP and is blocked while shut down.
 *
 * Real reference data: Smoke Machine (TL2, SV2, EP 2), AFF Coolant Foam
 * (TL3, EP 1, Uses 5), Spectrum chassis (Data Scanner, EP 2).
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injected store.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechSheet } from '../MechSheet'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'
import { must } from '../../__tests__/must'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 12,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 3,
  moduleSlots: 2,
  cargoCapacity: 4,
}

function makeMech(overrides: Partial<Mech>): Mech {
  return {
    id: 'mech-economy-1',
    schemaVersion: 1,
    name: 'Economy Test Mech',
    chassisRef: 'iron-mongrel',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    currentEP: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeCrawler(overrides: Partial<Crawler> = {}): Crawler {
  return {
    id: 'crawler-economy-1',
    schemaVersion: 1,
    name: 'Pool Crawler',
    techLevel: 'tech-2',
    systems: [],
    cargoLots: [],
    scrapPool: { tl2: 5 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Crawler
}

type CapturedUpdate = {
  type: string
  id: string
  patch: Record<string, unknown>
}

function makeStore(mech: Mech, captured: CapturedUpdate[], crawler?: Crawler) {
  let currentMech = mech
  const storeState = {
    pilots: [],
    mechs: [mech],
    crawlers: crawler ? [crawler] : [],
    softLinks: [],
    hydrated: { pilots: false, mechs: true, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [currentMech]),
    get: mock((type: string, id: string) => {
      if (type === 'mech' && id === currentMech.id) return currentMech
      if (type === 'crawler' && crawler && id === crawler.id) return crawler
      return null
    }),
    create: mock(async () => mech),
    update: mock(async (type: string, id: string, patch: Record<string, unknown>) => {
      captured.push({ type, id, patch })
      if (type === 'mech') currentMech = { ...currentMech, ...patch }
      return currentMech
    }),
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

function clickButton(name: RegExp) {
  const btn = screen.getByRole('button', { name })
  fireEvent.click(btn)
}

describe('MechSheet — no Use transaction on the Free-Edit sheet (ADR-021)', () => {
  test('a system offers no Use button — using a system is a Dashboard act', () => {
    // Push / Heat Check / "use a system" are Guided-Play transactions that live
    // on the Dashboard (see play/ActionsDeck), never on the Free-Edit Live Sheet.
    const mech = makeMech({ systems: ['Smoke Machine'], currentEP: 5 })
    render(<MechSheet mech={mech} chassis={fakeChassis} store={makeStore(mech, [])} />)

    expect(screen.queryByRole('button', { name: /^use smoke machine$/i })).toBeNull()
  })
})

describe('MechSheet — Damaged promotes Repair (S12)', () => {
  test('Damaged: Repair primary with half-SV cost', () => {
    const mech = makeMech({
      systems: ['Smoke Machine'],
      systemConditions: { 'Smoke Machine': 'damaged' },
    })
    render(<MechSheet mech={mech} chassis={fakeChassis} store={makeStore(mech, [])} />)

    // Smoke Machine SV 2 → half SV = 1 Scrap, shown on the button.
    const repair = screen.getByRole('button', {
      name: /^repair smoke machine$/i,
    })
    expect(repair.textContent).toMatch(/1 scrap/i)
  })

  test('Repair without deducting flips the item to Intact (never blocks)', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech({
      systems: ['Smoke Machine'],
      systemConditions: { 'Smoke Machine': 'damaged' },
    })
    // No crawler linked — the deduction option is disabled, repair is not.
    render(<MechSheet mech={mech} chassis={fakeChassis} store={makeStore(mech, captured)} />)

    await act(async () => {
      clickButton(/^repair smoke machine$/i)
    })
    const deduct = screen.getByRole('button', { name: /deduct scrap/i })
    expect((deduct as HTMLButtonElement).disabled).toBe(true)
    expect(deduct.getAttribute('title')).toMatch(/no crawler linked/i)

    await act(async () => {
      clickButton(/repair smoke machine without deducting/i)
    })

    expect(captured.length).toBe(1)
    expect(must(captured[0]).type).toBe('mech')
    expect(must(captured[0]).patch).toEqual({
      systemConditions: { 'Smoke Machine': 'intact' },
    })
  })

  test('Repair with deduction decrements the crawler TL pool bucket', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech({
      systems: ['Smoke Machine'],
      systemConditions: { 'Smoke Machine': 'damaged' },
    })
    const crawler = makeCrawler({ scrapPool: { tl2: 5 } })
    render(
      <MechSheet
        mech={mech}
        chassis={fakeChassis}
        store={makeStore(mech, captured, crawler)}
        crawler={crawler}
      />
    )

    await act(async () => {
      clickButton(/^repair smoke machine$/i)
    })
    await act(async () => {
      clickButton(/repair smoke machine and deduct scrap/i)
    })

    expect(captured.length).toBe(2)
    expect(must(captured[0]).patch).toEqual({
      systemConditions: { 'Smoke Machine': 'intact' },
    })
    expect(must(captured[1]).type).toBe('crawler')
    expect(must(captured[1]).patch).toEqual({ scrapPool: { tl2: 4 } })
  })
})

describe('MechSheet — per-item uses counters (rules B13)', () => {
  test('the stepper decrements the per-item uses counter', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech({
      systems: ['AFF Coolant Foam'],
      itemUses: { 'AFF Coolant Foam': 3 },
    })
    render(<MechSheet mech={mech} chassis={fakeChassis} store={makeStore(mech, captured)} />)

    expect(screen.getByText('Uses 3/5')).toBeTruthy()
    await act(async () => {
      clickButton(/decrease aff coolant foam uses/i)
    })

    expect(must(captured[0]).patch).toEqual({ itemUses: { 'AFF Coolant Foam': 2 } })
  })

  test('the stepper increments back up (downtime recharge by hand)', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech({
      systems: ['AFF Coolant Foam'],
      itemUses: { 'AFF Coolant Foam': 3 },
    })
    render(<MechSheet mech={mech} chassis={fakeChassis} store={makeStore(mech, captured)} />)

    await act(async () => {
      clickButton(/increase aff coolant foam uses/i)
    })

    expect(must(captured[0]).patch).toEqual({ itemUses: { 'AFF Coolant Foam': 4 } })
  })
})

describe('MechSheet — chassis ability slab', () => {
  test('Use spends the ability EP cost', async () => {
    const captured: CapturedUpdate[] = []
    // Spectrum's Data Scanner costs 2 EP. Real chassis → real ability slab.
    const mech = makeMech({ chassisRef: 'Spectrum', currentEP: 5 })
    render(<MechSheet mech={mech} store={makeStore(mech, captured)} />)

    await act(async () => {
      clickButton(/^use data scanner$/i)
    })

    expect(must(captured[0]).patch).toEqual({ currentEP: 3 })
  })

  test('Use is blocked while the mech is shut down', () => {
    const mech = makeMech({
      chassisRef: 'Spectrum',
      currentEP: 5,
      shutdown: true,
    })
    render(<MechSheet mech={mech} store={makeStore(mech, [])} />)

    const btn = screen.getByRole('button', { name: /^use data scanner$/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    expect(btn.getAttribute('title')).toMatch(/shut down/i)
  })
})
