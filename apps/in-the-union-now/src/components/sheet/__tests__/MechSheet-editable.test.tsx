/**
 * MechSheet — editable stat tests (#244).
 *
 * Verifies that clicking each of the six stat cells (HP, AP, TP, SP, EP, Heat),
 * typing a new value, and pressing Enter calls store.update with the correct
 * field patch: { currentXxx: N }.
 *
 * HP is covered by sheet-smoke.test.tsx (Scenario 6). All six are tested here
 * for completeness. Uses dep-injection (no mock.module()).
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), no mock.module().
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechSheet } from '../MechSheet'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis'])
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const fakeMech: Mech = {
  id: 'mech-editable-1',
  schemaVersion: 1,
  name: 'Edit Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargo: [],
  conditions: [],
  currentHP: 10,
  currentAP: 3,
  currentTP: 2,
  currentSP: 8,
  currentEP: 5,
  currentHeat: 4,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 12,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 3,
  moduleSlots: 2,
  cargoCapacity: 4,
}

type CapturedUpdate = { id: string; patch: Partial<Mech> }

function makeStore(mech: Mech, captured: CapturedUpdate[]): typeof useEntityStore {
  const updateMock = mock(async (_type: string, id: string, patch: Partial<Mech>) => {
    captured.push({ id, patch })
    return { ...mech, ...patch } as Mech
  })

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

// ---------------------------------------------------------------------------
// Helper: click stat button at given index, type value, press Enter
// ---------------------------------------------------------------------------

async function editStatByIndex(index: number, value: string): Promise<void> {
  const buttons = screen.getAllByRole('button')
  await act(async () => {
    fireEvent.click(buttons[index]!)
  })
  const input = screen.getByRole('spinbutton')
  await act(async () => {
    fireEvent.change(input, { target: { value } })
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

// ---------------------------------------------------------------------------
// Tests — one per stat
// The MechSheet renders stats in order: HP(0), AP(1), TP(2), SP(3), EP(4), Heat(5)
// ---------------------------------------------------------------------------

describe('MechSheet — editable stat: HP', () => {
  test('click HP, type new value, Enter → store.update called with { currentHP: N }', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStore(fakeMech, captured)} />
    )

    await editStatByIndex(0, '7')

    expect(captured.length).toBe(1)
    expect(captured[0]!.id).toBe('mech-editable-1')
    expect(captured[0]!.patch).toMatchObject({ currentHP: 7 })
  })
})

describe('MechSheet — editable stat: AP', () => {
  test('click AP, type new value, Enter → store.update called with { currentAP: N }', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStore(fakeMech, captured)} />
    )

    await editStatByIndex(1, '5')

    expect(captured.length).toBe(1)
    expect(captured[0]!.id).toBe('mech-editable-1')
    expect(captured[0]!.patch).toMatchObject({ currentAP: 5 })
  })
})

describe('MechSheet — editable stat: TP', () => {
  test('click TP, type new value, Enter → store.update called with { currentTP: N }', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStore(fakeMech, captured)} />
    )

    await editStatByIndex(2, '4')

    expect(captured.length).toBe(1)
    expect(captured[0]!.id).toBe('mech-editable-1')
    expect(captured[0]!.patch).toMatchObject({ currentTP: 4 })
  })
})

describe('MechSheet — editable stat: SP', () => {
  test('click SP, type new value, Enter → store.update called with { currentSP: N }', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStore(fakeMech, captured)} />
    )

    await editStatByIndex(3, '6')

    expect(captured.length).toBe(1)
    expect(captured[0]!.id).toBe('mech-editable-1')
    expect(captured[0]!.patch).toMatchObject({ currentSP: 6 })
  })
})

describe('MechSheet — editable stat: EP', () => {
  test('click EP, type new value, Enter → store.update called with { currentEP: N }', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStore(fakeMech, captured)} />
    )

    await editStatByIndex(4, '3')

    expect(captured.length).toBe(1)
    expect(captured[0]!.id).toBe('mech-editable-1')
    expect(captured[0]!.patch).toMatchObject({ currentEP: 3 })
  })
})

describe('MechSheet — editable stat: Heat', () => {
  test('click Heat, type new value, Enter → store.update called with { currentHeat: N }', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStore(fakeMech, captured)} />
    )

    await editStatByIndex(5, '9')

    expect(captured.length).toBe(1)
    expect(captured[0]!.id).toBe('mech-editable-1')
    expect(captured[0]!.patch).toMatchObject({ currentHeat: 9 })
  })
})
