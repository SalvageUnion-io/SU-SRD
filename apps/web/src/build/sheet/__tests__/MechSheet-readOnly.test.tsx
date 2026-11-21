import type { UnitsStore } from '../../../replica/units'
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
  conditions: ['Shutdown'],
  systemConditions: { 'smoke-machine': 'damaged' },
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
  techLevel: 2,
  systems: [],
  cargoLots: [],
  scrapPool: { tl2: 5 },
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
} as Crawler

function makeStubStore(mech: Mech, updateSpy?: ReturnType<typeof mock>): UnitsStore {
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
    const calm: Mech = { ...fakeMech, conditions: [] }
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

describe('MechSheet — no chassis stat column (C10)', () => {
  test("the opening prints no stat column: its facts are the band's, the gauges' and the Slabs'", () => {
    const spectrum: Mech = { ...fakeMech, chassisRef: 'spectrum', systems: [], cargoLots: [] }
    const { container } = render(
      <MechSheet mech={spectrum} store={makeStubStore(spectrum)} crawler={fakeCrawler} readOnly />
    )
    expect(container.querySelector('ul[aria-label="Chassis stats"]')).toBeNull()
    expect(container.textContent).not.toContain('Salvage Value')
  })
})

/** Read's chassis-ability group: the section its "Chassis ability" head (a dash group, h2) names. */
function chassisAbility(): HTMLElement {
  const head = screen.getByText('Chassis ability', { selector: 'h2, h2 *' })
  const section = head.closest<HTMLElement>('section')
  if (!section) throw new Error('no chassis ability group')
  return section
}

describe('MechSheet — the hero and the Chassis card', () => {
  test("Read's masthead wears the chassis art; the chassis ability leads the side column", () => {
    const spectrum: Mech = { ...fakeMech, chassisRef: 'spectrum', systems: [], cargoLots: [] }
    const { container } = render(
      <MechSheet mech={spectrum} store={makeStubStore(spectrum)} crawler={fakeCrawler} readOnly />
    )
    // Read is the sheet dashboard: the masthead's art is the player's photo,
    // the chassis art until changed.
    const mast = container.querySelector('.su-mast')
    expect(mast?.querySelector('img')?.getAttribute('alt')).toBe('Spectrum artwork')
    // The chassis ability is its own group, its name and every word showing.
    const ability = chassisAbility()
    expect(ability.textContent).toContain('Data Scanner')
    // Read leaves the pattern name out: it is the band's title.
    expect(container.textContent).not.toContain('Pattern name')
  })

  test('the chassis ability names its chassis, never the token', () => {
    const mazona: Mech = { ...fakeMech, chassisRef: 'mazona', systems: [], cargoLots: [] }
    render(<MechSheet mech={mazona} store={makeStubStore(mazona)} crawler={fakeCrawler} readOnly />)
    const ability = chassisAbility()
    expect(ability.textContent).toContain('Hover Drone')
    expect(ability.textContent).not.toContain('[(CHASSIS)]')
  })
})
