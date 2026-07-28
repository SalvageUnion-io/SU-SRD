/**
 * PilotSheet — Inventory slab (plan 4.4, design §4.2)
 *
 * Asserts that:
 *   1. The slab count shows truthful slot math (equipment 1 / Heavy 2,
 *      generic entries at explicit slotCost — Scrap 3, capacity 6).
 *   2. Per-item uses counters: Use decrements equipmentUses, Restock refills
 *      to the trait max, Use disabled at 0.
 *   3. Generic entries: + Scrap quick-add, free-form add, per-entry remove.
 *   4. readOnly suppresses every inventory edit affordance.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { PilotSheet } from '../PilotSheet'
import type { GenericInventoryEntry, Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { expandCards } from '../../__tests__/expandCards'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCRAP: GenericInventoryEntry = {
  id: 'gen-scrap-1',
  name: 'Scrap',
  slotCost: 3,
}

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-inv-1',
    schemaVersion: 1,
    name: 'Yara Voss',
    callsign: 'Ghost',
    classRef: 'scavenger',
    abilities: [],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    currentHP: 10,
    currentAP: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeStubStore(pilot: Pilot, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => pilot)
  return makeEntityStoreMock({
    pilots: [pilot],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [pilot]),
    get: mock((_type: string, id: string) => (id === pilot.id ? pilot : null)),
    create: mock(async () => pilot),
    update: updateMock,
    delete: mock(async () => {}),
  })
}

// ---------------------------------------------------------------------------
// Slot math
// ---------------------------------------------------------------------------

describe('PilotSheet — inventory slot math (rules A13)', () => {
  test('counts equipment 1 / Heavy 2 / Scrap 3 against capacity 6', () => {
    // Rifle 1 + Rocket Launcher (Heavy) 2 + Scrap 3 = 6
    const pilot = makePilot({
      equipment: ['Rifle', 'Rocket Launcher'],
      genericInventory: [SCRAP],
    })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(screen.getByText(/6 \/ 6 slots/)).toBeTruthy()
  })

  test('over-capacity totals render honestly (no clamp)', () => {
    const pilot = makePilot({
      equipment: ['Rifle'],
      genericInventory: [
        { ...SCRAP, qty: 2 },
        { ...SCRAP, id: 'gen-scrap-2' },
      ],
    })
    // 1 + 6 + 3 = 10
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(screen.getByText(/10 \/ 6 slots/)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Uses counters (rules A14)
// ---------------------------------------------------------------------------

describe('PilotSheet — per-item uses counters (rules A14)', () => {
  test('shows uses remaining out of the trait max', () => {
    const pilot = makePilot({
      equipment: ['First Aid Kit'],
      equipmentUses: { 'First Aid Kit': 1 },
    })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(screen.getByText('1/3')).toBeTruthy()
  })

  test('absent key reads as full uses', () => {
    const pilot = makePilot({ equipment: ['First Aid Kit'] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(screen.getByText('3/3')).toBeTruthy()
  })

  test('Use decrements the per-item counter', async () => {
    const pilot = makePilot({
      equipment: ['First Aid Kit'],
      equipmentUses: { 'First Aid Kit': 2 },
    })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use First Aid Kit' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      equipmentUses: { 'First Aid Kit': 1 },
    })
  })

  test('Use is disabled at 0; Restock refills to max', async () => {
    const pilot = makePilot({
      equipment: ['First Aid Kit'],
      equipmentUses: { 'First Aid Kit': 0 },
    })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    const useBtn = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Use First Aid Kit',
    })
    expect(useBtn.disabled).toBe(true)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restock First Aid Kit' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      equipmentUses: { 'First Aid Kit': 3 },
    })
  })

  test('no uses affordance on items without a uses trait', () => {
    const pilot = makePilot({ equipment: ['Rifle'] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(screen.queryByRole('button', { name: /use rifle/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Generic entries (plan S7)
// ---------------------------------------------------------------------------

describe('PilotSheet — generic inventory entries (plan S7)', () => {
  test('+ Scrap quick-adds a 3-slot Scrap entry', async () => {
    const pilot = makePilot()
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Scrap (3 slots)' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      genericInventory: [expect.objectContaining({ name: 'Scrap', slotCost: 3 })],
    })
  })

  test('free-form add persists name, slot cost and qty', async () => {
    const pilot = makePilot()
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'New item name' }), {
        target: { value: 'Salvaged Servo' },
      })
      fireEvent.change(screen.getByRole('spinbutton', { name: 'New item slot cost' }), {
        target: { value: '2' },
      })
      fireEvent.change(screen.getByRole('spinbutton', { name: 'New item quantity' }), {
        target: { value: '2' },
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add inventory item' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      genericInventory: [
        expect.objectContaining({
          name: 'Salvaged Servo',
          slotCost: 2,
          qty: 2,
        }),
      ],
    })
  })

  test('removing a generic entry filters it out', async () => {
    const pilot = makePilot({ genericInventory: [SCRAP] })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove Scrap' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      genericInventory: [],
    })
  })
})

// ---------------------------------------------------------------------------
// readOnly
// ---------------------------------------------------------------------------

describe('PilotSheet — inventory readOnly', () => {
  test('no use/restock/remove/add affordances', () => {
    const pilot = makePilot({
      equipment: ['First Aid Kit'],
      genericInventory: [SCRAP],
    })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />)
    expandCards()

    expect(screen.queryByRole('button', { name: /use first aid kit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /restock/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /remove scrap/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /add scrap/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /add inventory item/i })).toBeNull()
    // The slot math still renders
    expect(screen.getByText(/4 \/ 6 slots/)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Partner-granting equipment vs ordinary equipment (ADR-027)
// ---------------------------------------------------------------------------

/**
 * A pilot equips N items at will. SOME of those grant a partner (Survey Drone,
 * Mecha Companion, Auto-Turret); the rest are ordinary gear. Both kinds live in
 * the same `equipment[]` and both occupy inventory slots.
 *
 * ADR-028 renders a granting slug AS its partner: the grant and the granted
 * thing are one entry to the player, so one card, not two. The distinction that
 * survives is between RENDERING and SLOT COST — the equipment never leaves
 * `equipment[]`, so it still costs its slot even though the ordinary equipment
 * card is not what gets drawn.
 */
describe('PilotSheet — a partner-granting slug renders as its partner', () => {
  test('ordinary gear renders alongside the partner, and the grant is not drawn twice', async () => {
    const pilot = makePilot({
      equipment: ['first-aid-kit', 'survey-drone'],
      partners: [
        {
          id: 'p-custos',
          hostRef: 'survey-drone',
          hostSchema: 'equipment',
          name: 'Custos',
          systems: [],
          modules: [],
          conditions: [],
        },
      ],
    })
    render(
      <PilotSheet pilot={pilot} store={makeEntityStoreMock() as unknown as typeof useEntityStore} />
    )
    await expandCards()

    // Ordinary gear is untouched by the partner work.
    expect(screen.getAllByText(/First Aid Kit/i).length).toBeGreaterThan(0)
    // The partner renders under its OWN name, titleOverride-style.
    expect(screen.getAllByText(/Custos/i).length).toBeGreaterThan(0)
  })

  test('granting equipment still costs its inventory slot', () => {
    const bare = makePilot({ equipment: ['first-aid-kit'] })
    const withDrone = makePilot({ equipment: ['first-aid-kit', 'survey-drone'] })
    // Slot math is computed from `equipment[]`, so a granting item must count.
    expect(withDrone.equipment.length).toBe(bare.equipment.length + 1)
  })

  test('the equipment card no longer carries the loadout — the partner does', async () => {
    const pilot = makePilot({
      equipment: ['survey-drone'],
      partners: [
        {
          id: 'p-1',
          hostRef: 'survey-drone',
          hostSchema: 'equipment',
          systems: ['high-gain-antenna'],
          modules: [],
          conditions: [],
        },
      ],
    })
    render(
      <PilotSheet pilot={pilot} store={makeEntityStoreMock() as unknown as typeof useEntityStore} />
    )
    await expandCards()

    // The old PilotEquipmentLoadout rendered 'Add System' / 'Add Module'
    // controls inside the equipment card. The partner card carries the loadout
    // itself rather than a picker into it.
    expect(screen.queryByRole('button', { name: /add system/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /add module/i })).toBeNull()
    // The installed system rides the partner card.
    expect(screen.getAllByText(/High Gain Antenna/i).length).toBeGreaterThan(0)
  })
})
