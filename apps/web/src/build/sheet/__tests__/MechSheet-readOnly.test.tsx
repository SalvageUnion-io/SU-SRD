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
import { makeScrapLot } from 'game-domain/schemas/cargoLot'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import type { useEntityStore } from '../../../stores/entityStore'
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
  test("print in the hero's top-right corner, in the official sheet's words and the stat order", () => {
    // A real chassis, so every figure resolves from the reference data.
    const spectrum: Mech = { ...fakeMech, chassisRef: 'spectrum', systems: [], cargoLots: [] }
    const { container } = render(
      <MechSheet mech={spectrum} store={makeStubStore(spectrum)} crawler={fakeCrawler} readOnly />
    )
    const text = container.querySelector('ul[aria-label="Chassis stats"]')?.textContent ?? ''
    // The machine's figures, in the stat order every surface keeps: capacities,
    // not what is in use (the Systems and Modules counts and The Hold say that).
    const pairs = [
      'Tech Level 1',
      'Salvage Value 10',
      'Structure Points 17',
      'Energy Points 11',
      'System Slots 7',
      'Module Slots 4',
      'Heat Capacity 3',
      'Cargo Capacity 6',
    ]
    const at = pairs.map((pair) => text.indexOf(pair.replace(/ (\d+)$/, '$1')))
    expect(at.every((index) => index >= 0)).toBe(true)
    expect([...at].sort((x, y) => x - y)).toEqual(at)
  })
})

describe('MechSheet — the hero and the Chassis card', () => {
  test('the hero is image | text | stats + ability; the chassis callout leads the sidebar', () => {
    const spectrum: Mech = { ...fakeMech, chassisRef: 'spectrum', systems: [], cargoLots: [] }
    const { container } = render(
      <MechSheet mech={spectrum} store={makeStubStore(spectrum)} crawler={fakeCrawler} readOnly />
    )
    const hero = container.querySelector('section[aria-label="Snapshot Mech sheet header"]')
    const card = container.querySelector('section[aria-label="Chassis"]')
    expect(hero).not.toBeNull()
    expect(card).not.toBeNull()
    // The hero: the player's photo (the chassis art until changed), what they
    // wrote, then the chassis stats and the chassis ability as a library Compact.
    expect(hero?.querySelector('img')?.getAttribute('alt')).toBe('Spectrum artwork')
    expect(hero?.querySelector('ul[aria-label="Chassis stats"]')).not.toBeNull()
    const ability = hero?.querySelector('ul[aria-label="Chassis ability"] li')
    expect(ability?.textContent).toContain('Data Scanner')
    // Read leaves the pattern name out: it is the band's title.
    expect(hero?.textContent).not.toContain('Pattern name')
    // The card: the chassis's name, art and description, and nothing the hero has.
    expect(card?.textContent).toContain('Spectrum')
    // The callout leads the sidebar, above the Hold (owner's call,
    // 2026-10-20), with a CHASSIS chip beside its name.
    const aside = container.querySelector('[data-sheet-aside]')
    expect(hero?.contains(card ?? null)).toBe(false)
    expect(aside?.firstElementChild).toBe(card)
    expect(card?.querySelector('[data-chip-group]')?.textContent).toMatch(/chassis/i)
    expect(card?.querySelector('img')).not.toBeNull()
    expect(card?.querySelector('ul[aria-label="Chassis stats"]')).toBeNull()
    expect(card?.querySelector('[aria-label="Chassis ability"]')).toBeNull()
  })

  test('the ability is a Compact with no lead, which is an SRD index alone (EDL E11)', () => {
    const mazona: Mech = { ...fakeMech, chassisRef: 'mazona', systems: [], cargoLots: [] }
    const { container } = render(
      <MechSheet mech={mazona} store={makeStubStore(mazona)} crawler={fakeCrawler} readOnly />
    )
    const ability = container.querySelector('ul[aria-label="Chassis ability"] li')
    expect(ability?.textContent).toContain('Hover Drone')
    expect(ability?.querySelector('.su-entity-lead')).toBeNull()
    expect(ability?.textContent).not.toContain('[(CHASSIS)]')
  })
})
