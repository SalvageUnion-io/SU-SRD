/**
 * Condition tracking tests — REQ-011 (#240)
 *
 * Asserts that:
 *   1. Clicking a mech system ConditionToggle calls store.update with the
 *      correct systemConditions patch.
 *   2. Clicking a mech module ConditionToggle calls store.update with the
 *      correct moduleConditions patch.
 *   3. Clicking a pilot equipment ConditionToggle calls store.update with the
 *      correct equipmentConditions patch.
 *   4. The displayed condition value reflects what is stored.
 *   5. In readOnly mode, toggling is a no-op (store.update not called).
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechSheet } from '../MechSheet'
import { PilotSheet } from '../PilotSheet'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { must } from '../../__tests__/must'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'

// PilotSheet resolves equipment/ability slugs; MechSheet resolves
// system/module slugs, chassis stats and cargo caps at render — load all.
beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeMechStubStore(mech: Mech, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  return makeEntityStoreMock({
    mechs: [mech],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),
    get: mock((_type: string, id: string) => (id === mech.id ? mech : null)),
    create: mock(async () => mech),
    update: updateSpy ?? mock(async () => mech),
    delete: mock(async () => {}),
  })
}

function makePilotStubStore(
  pilot: Pilot,
  updateSpy?: ReturnType<typeof mock>
): typeof useEntityStore {
  return makeEntityStoreMock({
    pilots: [pilot],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [pilot]),
    get: mock((_type: string, id: string) => (id === pilot.id ? pilot : null)),
    create: mock(async () => pilot),
    update: updateSpy ?? mock(async () => pilot),
    delete: mock(async () => {}),
  })
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
  id: 'mech-cond-1',
  schemaVersion: 1,
  name: 'Test Mech',
  chassisRef: 'iron-mongrel',
  systems: ['plasma-torch'],
  modules: ['reinforced-hull'],
  cargoLots: [],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeMechWithConditions: Mech = {
  ...fakeMech,
  id: 'mech-cond-stored',
  systemConditions: { 'plasma-torch': 'damaged' },
  moduleConditions: { 'reinforced-hull': 'destroyed' },
}

const fakePilot: Pilot = {
  id: 'pilot-cond-1',
  schemaVersion: 1,
  name: 'Zara Quinn',
  callsign: 'Hex',
  classRef: 'scavenger',
  abilities: [],
  equipment: ['pistol'],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakePilotWithConditions: Pilot = {
  ...fakePilot,
  id: 'pilot-cond-stored',
  equipmentConditions: { pistol: 'damaged' },
}

// ---------------------------------------------------------------------------
// Mech system condition tests
// ---------------------------------------------------------------------------

describe('MechSheet — system status badge (REQ-011 #240, plan 4.5)', () => {
  // Item condition now cycles via the card status badge (design §4.5):
  // aria label is `Status: <Label> — click to change`.
  test('clicking a system status badge calls store.update with systemConditions patch', async () => {
    const updateSpy = mock(async () => fakeMech)
    const mech: Mech = { ...fakeMech, modules: [] } // one badge only
    render(
      <MechSheet mech={mech} chassis={fakeChassis} store={makeMechStubStore(mech, updateSpy)} />
    )

    const badge = screen.getByRole('button', { name: /status: intact/i })
    await act(async () => {
      fireEvent.click(badge)
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'mech',
      mech.id,
      {
        systemConditions: { 'plasma-torch': 'damaged' },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('displayed condition reflects stored systemConditions value', () => {
    render(
      <MechSheet
        mech={fakeMechWithConditions}
        chassis={fakeChassis}
        store={makeMechStubStore(fakeMechWithConditions)}
      />
    )

    // 'plasma-torch' is stored as 'damaged', 'reinforced-hull' as 'destroyed'
    expect(screen.getByRole('button', { name: /status: damaged/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /status: destroyed/i })).toBeTruthy()
  })

  test('readOnly: no interactive status badges, store.update never called', async () => {
    const updateSpy = mock(async () => fakeMech)
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeMechStubStore(fakeMech, updateSpy)}
        readOnly
      />
    )

    expect(screen.queryByRole('button', { name: /status:/i })).toBeNull()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Mech module condition tests
// ---------------------------------------------------------------------------

describe('MechSheet — module status badge (REQ-011 #240, plan 4.5)', () => {
  test('clicking a module status badge calls store.update with moduleConditions patch', async () => {
    const updateSpy = mock(async () => fakeMech)
    const mech: Mech = { ...fakeMech, systems: [] } // one badge only
    render(
      <MechSheet mech={mech} chassis={fakeChassis} store={makeMechStubStore(mech, updateSpy)} />
    )

    const badge = screen.getByRole('button', { name: /status: intact/i })
    await act(async () => {
      fireEvent.click(badge)
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'mech',
      mech.id,
      {
        moduleConditions: { 'reinforced-hull': 'damaged' },
      },
      LIVE_SHEET_MANUAL
    )
  })
})

// ---------------------------------------------------------------------------
// Pilot equipment condition tests
// ---------------------------------------------------------------------------

describe('PilotSheet — equipment condition toggle (REQ-011 #240)', () => {
  // Equipment condition now cycles via the card status badge (design §4.5):
  // aria label is `Status: <Label> — click to change`.
  test('clicking an equipment status badge calls store.update with equipmentConditions patch', async () => {
    const updateSpy = mock(async () => fakePilot)
    render(<PilotSheet pilot={fakePilot} store={makePilotStubStore(fakePilot, updateSpy)} />)

    const toggle = screen.getByRole('button', { name: /status: intact/i })
    await act(async () => {
      fireEvent.click(toggle)
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      fakePilot.id,
      {
        equipmentConditions: { pistol: 'damaged' },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('displayed condition reflects stored equipmentConditions value', () => {
    render(
      <PilotSheet
        pilot={fakePilotWithConditions}
        store={makePilotStubStore(fakePilotWithConditions)}
      />
    )

    // 'pistol' is stored as 'damaged'
    const toggle = screen.getByRole('button', { name: /status: damaged/i })
    expect(toggle).toBeTruthy()
  })

  test('readOnly: no interactive status badge, store.update never called', async () => {
    const updateSpy = mock(async () => fakePilot)
    render(
      <PilotSheet pilot={fakePilot} store={makePilotStubStore(fakePilot, updateSpy)} readOnly />
    )

    // In readOnly mode the badge renders as a static span, not a button
    expect(screen.queryByRole('button', { name: /status:/i })).toBeNull()
    expect(screen.getByText('Intact')).toBeTruthy()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Stale-closure regression (formal-review fix): the handler must merge from the
// freshest store state, not the render-time prop, so a condition set by a prior
// (not-yet-re-rendered) toggle is preserved instead of being stomped.
// ---------------------------------------------------------------------------

describe('MechSheet — condition merge reads live store, not stale prop (#240 regression)', () => {
  test('preserves a prior condition that exists in the store but not in the render prop', async () => {
    const updateSpy = mock(async () => fakeMech)
    // Prop has NO conditions yet; the store (get) already holds a prior toggle.
    const propMech: Mech = { ...fakeMech, systemConditions: {} }
    const freshMech: Mech = {
      ...fakeMech,
      systemConditions: { 'prior-system': 'destroyed' },
    }
    const store = makeEntityStoreMock({
      mechs: [freshMech],
      hydrated: {
        pilots: false,
        mechs: true,
        crawlers: false,
        softLinks: false,
      },
      hydrate: mock(async () => {}),
      list: mock(() => [freshMech]),
      // get returns the FRESH mech (with the prior condition), unlike the prop
      get: mock((_type: string, id: string) => (id === fakeMech.id ? freshMech : null)),
      create: mock(async () => fakeMech),
      update: updateSpy,
      delete: mock(async () => {}),
    })

    render(<MechSheet mech={propMech} chassis={fakeChassis} store={store} />)

    const badge = must(
      screen.getAllByRole('button', {
        name: /status: intact/i,
      })[0]
    )
    await act(async () => {
      fireEvent.click(badge)
    })

    // The patch must include BOTH the prior store condition and the new one —
    // proving the merge base came from store.get, not the empty prop map.
    expect(updateSpy).toHaveBeenCalledWith(
      'mech',
      fakeMech.id,
      {
        systemConditions: {
          'prior-system': 'destroyed',
          'plasma-torch': 'damaged',
        },
      },
      LIVE_SHEET_MANUAL
    )
  })
})
