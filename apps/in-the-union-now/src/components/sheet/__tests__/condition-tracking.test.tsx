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

// PilotSheet resolves equipment/ability slugs and MechSheet resolves
// system/module slugs via salvageunion-reference at render.
beforeAll(async () => {
  await SalvageUnionReference.preload(['equipment', 'abilities', 'systems', 'modules'])
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeMechStubStore(mech: Mech, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => mech)
  const storeState = {
    pilots: [],
    mechs: [mech],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: mock((_type: string, id: string) => (id === mech.id ? mech : null)) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => mech) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

function makePilotStubStore(
  pilot: Pilot,
  updateSpy?: ReturnType<typeof mock>
): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => pilot)
  const storeState = {
    pilots: [pilot],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [pilot]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: mock((_type: string, id: string) => (id === pilot.id ? pilot : null)) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => pilot) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
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
  cargo: [],
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
  rollResults: [],
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

describe('MechSheet — system condition toggle (REQ-011 #240)', () => {
  test('clicking a system toggle calls store.update with systemConditions patch', async () => {
    const updateSpy = mock(async () => fakeMech)
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeMechStubStore(fakeMech, updateSpy)}
      />
    )

    // The system 'plasma-torch' should show as 'Intact' initially
    const toggle = screen.getByRole('button', { name: /plasma-torch condition/i })
    await act(async () => {
      fireEvent.click(toggle)
    })

    // Should update systemConditions: { 'plasma-torch': 'damaged' }
    expect(updateSpy).toHaveBeenCalledWith('mech', fakeMech.id, {
      systemConditions: { 'plasma-torch': 'damaged' },
    })
  })

  test('displayed condition reflects stored systemConditions value', () => {
    render(
      <MechSheet
        mech={fakeMechWithConditions}
        chassis={fakeChassis}
        store={makeMechStubStore(fakeMechWithConditions)}
      />
    )

    // 'plasma-torch' is stored as 'damaged'
    const toggle = screen.getByRole('button', { name: /plasma-torch condition: damaged/i })
    expect(toggle).toBeTruthy()
  })

  test('readOnly: clicking system toggle does not call store.update', async () => {
    const updateSpy = mock(async () => fakeMech)
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeMechStubStore(fakeMech, updateSpy)}
        readOnly
      />
    )

    // In readOnly mode, no role=button toggles should appear
    expect(screen.queryByRole('button', { name: /plasma-torch condition/i })).toBeNull()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Mech module condition tests
// ---------------------------------------------------------------------------

describe('MechSheet — module condition toggle (REQ-011 #240)', () => {
  test('clicking a module toggle calls store.update with moduleConditions patch', async () => {
    const updateSpy = mock(async () => fakeMech)
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeMechStubStore(fakeMech, updateSpy)}
      />
    )

    const toggle = screen.getByRole('button', { name: /reinforced-hull condition/i })
    await act(async () => {
      fireEvent.click(toggle)
    })

    expect(updateSpy).toHaveBeenCalledWith('mech', fakeMech.id, {
      moduleConditions: { 'reinforced-hull': 'damaged' },
    })
  })

  test('displayed condition reflects stored moduleConditions value', () => {
    render(
      <MechSheet
        mech={fakeMechWithConditions}
        chassis={fakeChassis}
        store={makeMechStubStore(fakeMechWithConditions)}
      />
    )

    // 'reinforced-hull' is stored as 'destroyed'
    const toggle = screen.getByRole('button', { name: /reinforced-hull condition: destroyed/i })
    expect(toggle).toBeTruthy()
  })

  test('readOnly: clicking module toggle does not call store.update', async () => {
    const updateSpy = mock(async () => fakeMech)
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeMechStubStore(fakeMech, updateSpy)}
        readOnly
      />
    )

    expect(screen.queryByRole('button', { name: /reinforced-hull condition/i })).toBeNull()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Pilot equipment condition tests
// ---------------------------------------------------------------------------

describe('PilotSheet — equipment condition toggle (REQ-011 #240)', () => {
  test('clicking an equipment toggle calls store.update with equipmentConditions patch', async () => {
    const updateSpy = mock(async () => fakePilot)
    render(<PilotSheet pilot={fakePilot} store={makePilotStubStore(fakePilot, updateSpy)} />)

    const toggle = screen.getByRole('button', { name: /pistol condition/i })
    await act(async () => {
      fireEvent.click(toggle)
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', fakePilot.id, {
      equipmentConditions: { pistol: 'damaged' },
    })
  })

  test('displayed condition reflects stored equipmentConditions value', () => {
    render(
      <PilotSheet
        pilot={fakePilotWithConditions}
        store={makePilotStubStore(fakePilotWithConditions)}
      />
    )

    // 'pistol' is stored as 'damaged'
    const toggle = screen.getByRole('button', { name: /pistol condition: damaged/i })
    expect(toggle).toBeTruthy()
  })

  test('readOnly: clicking equipment toggle does not call store.update', async () => {
    const updateSpy = mock(async () => fakePilot)
    render(
      <PilotSheet pilot={fakePilot} store={makePilotStubStore(fakePilot, updateSpy)} readOnly />
    )

    // In readOnly mode, no interactive toggle button should appear
    expect(screen.queryByRole('button', { name: /pistol condition/i })).toBeNull()
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
    const storeState = {
      pilots: [],
      mechs: [freshMech],
      crawlers: [],
      softLinks: [],
      hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
      hydrate: mock(async () => {}),
      list: mock(() => [freshMech]),
      // get returns the FRESH mech (with the prior condition), unlike the prop
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get: mock((_type: string, id: string) => (id === fakeMech.id ? freshMech : null)) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: mock(async () => fakeMech) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: updateSpy as any,
      delete: mock(async () => {}),
    }
    const store = (() => storeState) as unknown as typeof useEntityStore

    render(<MechSheet mech={propMech} chassis={fakeChassis} store={store} />)

    const toggle = screen.getByRole('button', { name: /plasma-torch condition/i })
    await act(async () => {
      fireEvent.click(toggle)
    })

    // The patch must include BOTH the prior store condition and the new one —
    // proving the merge base came from store.get, not the empty prop map.
    expect(updateSpy).toHaveBeenCalledWith('mech', fakeMech.id, {
      systemConditions: { 'prior-system': 'destroyed', 'plasma-torch': 'damaged' },
    })
  })
})
