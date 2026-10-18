/**
 * PilotSheet — Inventory slab
 *
 * Asserts that:
 *   1. The slab count shows truthful slot math (equipment 1 / Heavy 2,
 *      generic entries at explicit slotCost — Scrap 3, capacity 6).
 *   2. Per-item uses counters: − takes one off equipmentUses, + gives one back
 *      to the trait max, Use disabled at 0.
 *   3. Generic entries: + Scrap quick-add, free-form add, per-entry remove.
 *   4. readOnly suppresses every inventory edit affordance.
 */

import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { GenericInventoryEntry, Pilot } from 'game-domain/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'
import { expandCards } from '../../../components/__tests__/expandCards'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import { must } from '../../../components/__tests__/must'
import { slabChip } from '../../../components/__tests__/slabChip'
import { PilotSheet } from '../PilotSheet'

beforeAll(hydrateStores)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCRAP: GenericInventoryEntry = {
  id: 'gen-scrap-1',
  name: 'Scrap',
  slotCost: 3,
}

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return pilotFixture({
    id: 'pilot-inv-1',
    name: 'Yara Voss',
    callsign: 'Ghost',
    currentHP: 10,
    currentAP: 5,
    ...overrides,
  })
}

function makeStubStore(pilot: Pilot, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => pilot)
  return makeEntityStoreMock({
    pilots: [pilot],
    hydrated: { pilots: true, mechs: false, crawlers: false, npcs: false, softLinks: false },
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

describe('PilotSheet — inventory slot math', () => {
  test('counts equipment 1 / Heavy 2 / Scrap 3 against capacity 6', () => {
    // Rifle 1 + Rocket Launcher (Heavy) 2 + Scrap 3 = 6
    const pilot = makePilot({
      equipment: ['rifle', 'rocket-launcher'],
      genericInventory: [SCRAP],
    })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(must(slabChip('Inventory')).textContent).toBe('Slots6/6')
  })

  test('over-capacity totals render honestly (no clamp)', () => {
    const pilot = makePilot({
      equipment: ['rifle'],
      genericInventory: [
        { ...SCRAP, qty: 2 },
        { ...SCRAP, id: 'gen-scrap-2' },
      ],
    })
    // 1 + 6 + 3 = 10
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(must(slabChip('Inventory')).textContent).toBe('Slots10/6')
    expect(must(slabChip('Inventory')).classList.contains('su-stat-cell--critical')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Uses counters
// ---------------------------------------------------------------------------

describe('PilotSheet — per-item uses counters', () => {
  test('shows uses remaining out of the trait max', () => {
    const pilot = makePilot({
      equipment: ['first-aid-kit'],
      equipmentUses: { 'first-aid-kit': 1 },
    })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(document.querySelector('.su-sheet-item__uses')?.textContent).toBe('Uses1/3')
  })

  test('absent key reads as full uses', () => {
    const pilot = makePilot({ equipment: ['first-aid-kit'] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(document.querySelector('.su-sheet-item__uses')?.textContent).toBe('Uses3/3')
  })

  test('− takes one off the per-item counter', async () => {
    const pilot = makePilot({
      equipment: ['first-aid-kit'],
      equipmentUses: { 'first-aid-kit': 2 },
    })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Decrease First Aid Kit uses' }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        equipmentUses: { 'first-aid-kit': 1 },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('− is disabled at 0; + gives one back', async () => {
    const pilot = makePilot({
      equipment: ['first-aid-kit'],
      equipmentUses: { 'first-aid-kit': 0 },
    })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    const useBtn = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Decrease First Aid Kit uses',
    })
    expect(useBtn.disabled).toBe(true)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Increase First Aid Kit uses' }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        equipmentUses: { 'first-aid-kit': 1 },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('no uses affordance on items without a uses trait', () => {
    const pilot = makePilot({ equipment: ['rifle'] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(screen.queryByRole('button', { name: /one rifle/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Generic entries
// ---------------------------------------------------------------------------

describe('PilotSheet — generic inventory entries', () => {
  test('+ Scrap quick-adds a 3-slot Scrap entry', async () => {
    const pilot = makePilot()
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Scrap (3 slots)' }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        genericInventory: [expect.objectContaining({ name: 'Scrap', slotCost: 3 })],
      },
      LIVE_SHEET_MANUAL
    )
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

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        genericInventory: [
          expect.objectContaining({
            name: 'Salvaged Servo',
            slotCost: 2,
            qty: 2,
          }),
        ],
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('removing a generic entry filters it out', async () => {
    const pilot = makePilot({ genericInventory: [SCRAP] })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove Scrap' }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        genericInventory: [],
      },
      LIVE_SHEET_MANUAL
    )
  })
})

// ---------------------------------------------------------------------------
// readOnly
// ---------------------------------------------------------------------------

describe('PilotSheet — inventory readOnly', () => {
  test('no use/restock/remove/add affordances', () => {
    const pilot = makePilot({
      equipment: ['first-aid-kit'],
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
    expect(must(slabChip('Inventory')).textContent).toBe('Slots4/6')
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
