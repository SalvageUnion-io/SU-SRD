/**
 * MechSheet — readOnly prop tests (#242, plan 4.5)
 *
 * When readOnly is true (e.g. in SnapshotView), the body suppresses every
 * edit affordance: no Heat Check / Push rolls, no flag clears, no Use /
 * Repair / uses steppers, no status-badge cycling (badges render as plain
 * spans), no Stow buttons on the hold — and the store is never written.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechSheet } from '../MechSheet'
import { makeScrapLot } from '../../../lib/schemas/cargoLot'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 14,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 3,
  moduleSlots: 2,
  cargoCapacity: 4,
}

const fakeMech: Mech = {
  id: 'mech-snapshot-1',
  schemaVersion: 1,
  name: 'Snapshot Mech',
  chassisRef: 'iron-mongrel',
  systems: ['Smoke Machine'],
  modules: [],
  cargoLots: [makeScrapLot(2, 2)],
  conditions: [],
  systemConditions: { 'Smoke Machine': 'damaged' },
  shutdown: true,
  currentSP: 8,
  currentEP: 5,
  currentHeat: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler = {
  id: 'crawler-snapshot-1',
  schemaVersion: 1,
  name: 'Snapshot Crawler',
  techLevel: 'tech-2',
  systems: [],
  cargoLots: [],
  scrapPool: { tl2: 5 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as Crawler

function makeStubStore(mech: Mech, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => mech)
  const storeState = {
    pilots: [],
    mechs: [mech],
    crawlers: [fakeCrawler],
    softLinks: [],
    hydrated: { pilots: false, mechs: true, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),
    get: mock((type: string, id: string) => {
      if (type === 'mech' && id === mech.id) return mech
      if (type === 'crawler' && id === fakeCrawler.id) return fakeCrawler
      return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => mech) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

describe('MechSheet — readOnly', () => {
  test('no edit affordances render: rolls, clears, Use/Repair, steppers, stow', () => {
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeStubStore(fakeMech)}
        crawler={fakeCrawler}
        readOnly
      />
    )

    expect(screen.queryByRole('button', { name: /heat check/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /push/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /clear shutdown/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^use /i })).toBeNull()
    expect(screen.queryByRole('button', { name: /repair/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /uses/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^stow /i })).toBeNull()
    // Status badge renders as a plain span, not a cycle button.
    expect(screen.queryByRole('button', { name: /status:/i })).toBeNull()
    expect(screen.getAllByText(/damaged/i).length).toBeGreaterThan(0)
  })

  test('content still renders: system card, hold lot, shutdown notice', () => {
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeStubStore(fakeMech)}
        crawler={fakeCrawler}
        readOnly
      />
    )

    expect(screen.getAllByText('Smoke Machine').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/scrap/i).length).toBeGreaterThan(0) // the SCRAP lot chit
    expect(screen.getByText(/shut down/i)).toBeTruthy()
  })

  test('store.update is never called from a readOnly body', async () => {
    const updateSpy = mock(async () => fakeMech)
    const { container } = render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeStubStore(fakeMech, updateSpy)}
        crawler={fakeCrawler}
        readOnly
      />
    )

    // Click everything clickable-looking; nothing may mutate.
    await act(async () => {
      container.querySelectorAll('button').forEach((btn) => {
        fireEvent.click(btn)
      })
    })

    expect(updateSpy).not.toHaveBeenCalled()
  })
})
