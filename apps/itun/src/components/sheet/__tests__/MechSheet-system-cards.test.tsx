/**
 * MechSheet — system/module entity cards on the LiveSheet body (plan 4.5).
 *
 * Systems and modules render as EntityGridRow'd full ReferenceEntityCard cards with
 * a status badge (Intact → Damaged → Destroyed cycle persists through the
 * store) — the per-item conditions vocabulary from rules B12.
 *
 * Asserts:
 *   1. A real system resolves and renders as a card (name + a stat).
 *   2. The status badge cycle persists via store.update (intact → damaged).
 *   3. An unresolvable slug falls back to plain text (no crash) and its
 *      status badge still persists.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), no mock.module(),
 * dep-injected store.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'
import { expandCards } from '../../__tests__/expandCards'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { MechSheet } from '../MechSheet'

// MechSheet resolves system/module slugs against the reference data at render.
beforeAll(async () => {
  // Full entity cards resolve actions/keywords/traits/distances — load all.
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

// A real, choice-free system. ".50 Cal Machine Gun" is TL1 and renders with a
// recognisable name + a "Tech Level" stat.
const REAL_SYSTEM = '.50 Cal Machine Gun'

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 14,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 3,
  moduleSlots: 2,
  cargoCapacity: 4,
}

function makeMech(overrides: Partial<Mech>): Mech {
  return {
    id: 'mech-cards-1',
    schemaVersion: 1,
    name: 'Card Test Mech',
    chassisRef: 'iron-mongrel',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeStubStore(mech: Mech, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => mech)
  return makeEntityStoreMock({
    mechs: [mech],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),

    get: mock((_type: string, id: string) => (id === mech.id ? mech : null)),
    create: mock(async () => mech),
    update: updateMock,
    delete: mock(async () => {}),
  })
}

describe('MechSheet — system/module entity cards (plan 4.5)', () => {
  test('a real system renders as a card with its name and a stat', () => {
    const mech = makeMech({ systems: [REAL_SYSTEM] })
    render(<MechSheet mech={mech} chassis={fakeChassis} store={makeStubStore(mech)} />)
    // Item cards ship collapsed, so the foot stats are not in the DOM until the
    // card is opened — the same affordance a player clicks.
    expandCards()

    // Name (from the reference entity, not the bare slug span).
    expect(screen.getAllByText(REAL_SYSTEM).length).toBeGreaterThan(0)
    // A stat surfaced by the entity display. 'Slots' rather than 'Tech Level':
    // the identity panel's Tech Level FIELD is gone (it is chassis-derived and
    // reads off the static-stats strip), while 'Slots' appears only on an item
    // card — so this still proves the CARD rendered, not the strip. Cased as
    // the DOM has it; the all-caps is a CSS transform, which text queries do
    // not see.
    expect(screen.getAllByText('Slots').length).toBeGreaterThan(0)
  })

  test('the status badge cycle persists via store.update (intact → damaged)', async () => {
    const mech = makeMech({ systems: [REAL_SYSTEM] })
    const updateSpy = mock(async () => mech)
    render(<MechSheet mech={mech} chassis={fakeChassis} store={makeStubStore(mech, updateSpy)} />)

    const badge = screen.getByRole('button', { name: /status: intact/i })
    await act(async () => {
      fireEvent.click(badge)
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'mech',
      mech.id,
      {
        systemConditions: { [REAL_SYSTEM]: 'damaged' },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('an unresolvable module slug falls back to plain text and still cycles', async () => {
    const mech = makeMech({ modules: ['totally-not-a-real-module'] })
    const updateSpy = mock(async () => mech)
    render(<MechSheet mech={mech} chassis={fakeChassis} store={makeStubStore(mech, updateSpy)} />)

    // Fallback: the raw slug text is rendered (no crash).
    expect(screen.getByText('totally-not-a-real-module')).toBeTruthy()

    const badge = screen.getByRole('button', { name: /status: intact/i })
    await act(async () => {
      fireEvent.click(badge)
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'mech',
      mech.id,
      {
        moduleConditions: { 'totally-not-a-real-module': 'damaged' },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('a damaged status badge cycles on to destroyed', async () => {
    const mech = makeMech({
      systems: [REAL_SYSTEM],
      systemConditions: { [REAL_SYSTEM]: 'damaged' },
    })
    const updateSpy = mock(async () => mech)
    render(<MechSheet mech={mech} chassis={fakeChassis} store={makeStubStore(mech, updateSpy)} />)

    const badge = screen.getByRole('button', { name: /status: damaged/i })
    await act(async () => {
      fireEvent.click(badge)
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'mech',
      mech.id,
      {
        systemConditions: { [REAL_SYSTEM]: 'destroyed' },
      },
      LIVE_SHEET_MANUAL
    )
  })
})
