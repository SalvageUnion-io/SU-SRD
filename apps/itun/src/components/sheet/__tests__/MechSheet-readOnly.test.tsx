/**
 * MechSheet — readOnly prop tests (poster regions)
 *
 * When readOnly is true (e.g. in PublicSheet), the body suppresses every
 * edit affordance: no Identity/Quirk-Appearance Edit buttons, no Vitals gauge
 * segments, no Use / Repair / uses steppers, no status-badge cycling (badges
 * render as plain spans), no Stow buttons on the hold — and the store is
 * never written.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { makeScrapLot } from 'itun-domain/schemas/cargoLot'
import type { Crawler } from 'itun-domain/schemas/crawler'
import type { Mech } from 'itun-domain/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { MechSheet } from '../MechSheet'

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
  systems: ['smoke-machine'],
  modules: [],
  cargoLots: [makeScrapLot(2, 2)],
  conditions: [],
  systemConditions: { 'smoke-machine': 'damaged' },
  shutdown: true,
  currentSP: 8,
  currentEP: 5,
  currentHeat: 2,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

const fakeCrawler = {
  id: 'crawler-snapshot-1',
  schemaVersion: 1,
  name: 'Snapshot Crawler',
  techLevel: 'tech-2',
  systems: [],
  cargoLots: [],
  scrapPool: { tl2: 5 },
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
} as Crawler

function makeStubStore(mech: Mech, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => mech)
  return makeEntityStoreMock({
    mechs: [mech],
    crawlers: [fakeCrawler],
    hydrated: { pilots: false, mechs: true, crawlers: true, npcs: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),
    get: mock((type: string, id: string) => {
      if (type === 'mech' && id === mech.id) return mech
      if (type === 'crawler' && id === fakeCrawler.id) return fakeCrawler
      return null
    }),
    create: mock(async () => mech),
    update: updateMock,
    delete: mock(async () => {}),
  })
}

describe('MechSheet — readOnly', () => {
  test('no edit affordances render: Identity/Quirk edit, Use/Repair, steppers, stow', () => {
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeStubStore(fakeMech)}
        crawler={fakeCrawler}
        readOnly
      />
    )

    expect(screen.queryByRole('button', { name: /^edit identity$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^edit quirk & appearance$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^use /i })).toBeNull()
    expect(screen.queryByRole('button', { name: /repair/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /uses/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^stow /i })).toBeNull()
    // Status badge renders as a plain span, not a cycle button.
    expect(screen.queryByRole('button', { name: /status:/i })).toBeNull()
    expect(screen.getAllByText(/damaged/i).length).toBeGreaterThan(0)
  })

  test('content still renders: system card, hold lot, unified shutdown condition chip', () => {
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
    // The `shutdown` flag surfaces as a unified Conditions chip (Vitals card)
    // now that the standalone Heat Check panel is dropped (the poster redesign).
    expect(screen.getByText('Shutdown')).toBeTruthy()
  })

  test('Read leaves out an empty Conditions field instead of drawing a box', () => {
    const calm: Mech = { ...fakeMech, shutdown: false, conditions: [] }
    render(
      <MechSheet
        mech={calm}
        chassis={fakeChassis}
        store={makeStubStore(calm)}
        crawler={fakeCrawler}
        readOnly
      />
    )
    expect(screen.queryByText('Conditions')).toBeNull()
    expect(screen.queryByText('None')).toBeNull()
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

describe('MechSheet — the Chassis stats', () => {
  test("print on the Chassis card's head, its stats spelled out", () => {
    // A real chassis, so every figure resolves from the reference data.
    const spectrum: Mech = { ...fakeMech, chassisRef: 'spectrum', systems: [], cargoLots: [] }
    const { container } = render(
      <MechSheet mech={spectrum} store={makeStubStore(spectrum)} crawler={fakeCrawler} readOnly />
    )
    const text = container.querySelector('section[aria-label="Chassis"]')?.textContent ?? ''
    // The machine's figures, in the sheet's order: capacities, not what is in
    // use (the Systems and Modules counts and The Hold say that).
    const pairs = [
      'Structure Points 17',
      'Energy Points 11',
      'Heat Capacity 3',
      'System Slots 7',
      'Module Slots 4',
      'Cargo Capacity 6',
      'Tech Level 1',
      'Salvage Value 10',
    ]
    const at = pairs.map((pair) => text.indexOf(pair.replace(/ (\d+)$/, '$1')))
    expect(at.every((index) => index >= 0)).toBe(true)
    expect([...at].sort((x, y) => x - y)).toEqual(at)
  })
})

describe('MechSheet — the Chassis card', () => {
  test("the chassis is its own reference card, apart from the player's hero", () => {
    const spectrum: Mech = { ...fakeMech, chassisRef: 'spectrum', systems: [], cargoLots: [] }
    const { container } = render(
      <MechSheet mech={spectrum} store={makeStubStore(spectrum)} crawler={fakeCrawler} readOnly />
    )
    const hero = container.querySelector('section[aria-label="Snapshot Mech sheet header"]')
    const card = container.querySelector('section[aria-label="Chassis"]')
    expect(hero).not.toBeNull()
    expect(card).not.toBeNull()
    // The hero is the player's photo (the chassis art until changed) and what
    // they wrote; nothing read off the chassis.
    expect(hero?.querySelector('img')?.getAttribute('alt')).toBe('Spectrum artwork')
    expect(hero?.querySelector('dl[aria-label="Chassis stats"]')).toBeNull()
    expect(hero?.querySelector('[aria-label="Chassis ability"]')).toBeNull()
    expect(hero?.textContent).not.toContain('Spectrum')
    // The card: the chassis's name, art and description, with its ability's Card.
    expect(card?.textContent).toContain('Spectrum')
    expect(card?.querySelector('img')).not.toBeNull()
    const ability = card?.querySelector('section[aria-label="Chassis ability"]')
    expect(ability?.childElementCount).toBeGreaterThan(0)
    expect(ability?.querySelector('.su-entity-token')).toBeNull()
  })
})
