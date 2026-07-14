/**
 * Unit tests for useEquipmentLoadout.
 *
 * Tests that:
 * - loadout comes from the `seed` param, falling back to a stable empty loadout
 * - add/remove persist via store.update, kebab-slugifying the added NAME and
 *   MERGING pilot.equipmentLoadouts so sibling equipment loadouts aren't clobbered
 * - handlers read the FRESHEST record (sequential adds accumulate — stale-closure guard)
 *
 * Dep-injection only — NO mock.module().
 */

import '@testing-library/jest-dom'
import { describe, expect, mock, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'

import { useEquipmentLoadout } from '../useEquipmentLoadout'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'

const PILOT_ID = 'pilot-loadout-1'
const SLUG = 'survey-drone'

function makePilot(equipmentLoadouts?: Pilot['equipmentLoadouts']): Pilot {
  return {
    id: PILOT_ID,
    schemaVersion: 1,
    name: 'Test Pilot',
    callsign: 'Tester',
    classRef: 'scout',
    abilities: [],
    equipment: ['survey-drone', 'mecha-companion'],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    equipmentLoadouts,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function makeStore(initial: Pilot) {
  let current = initial
  const updateFn = mock(async (_type: string, _id: string, patch: Partial<Pilot>) => {
    current = { ...current, ...patch }
    return current
  })
  const storeState = {
    pilots: [current],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [current]),
    get: mock((_type: string, id: string) => (id === current.id ? current : null)),
    create: mock(async () => current),
    update: updateFn,
    delete: mock(async () => {}),
  }
  const store = (() => storeState) as unknown as typeof useEntityStore
  return { store, updateFn, getCurrent: () => current }
}

describe('useEquipmentLoadout — seeding', () => {
  test('seeds an empty loadout (stable ref) when no seed is provided', () => {
    const { store } = makeStore(makePilot())
    const { result, rerender } = renderHook(() =>
      useEquipmentLoadout(PILOT_ID, SLUG, undefined, store)
    )
    expect(result.current.loadout).toEqual({ systems: [], modules: [] })
    const first = result.current.loadout
    rerender()
    expect(result.current.loadout).toBe(first)
  })

  test('returns the seed loadout verbatim', () => {
    const seed = { systems: ['red-laser'], modules: ['comms-module'] }
    const { store } = makeStore(makePilot())
    const { result } = renderHook(() => useEquipmentLoadout(PILOT_ID, SLUG, seed, store))
    expect(result.current.loadout).toBe(seed)
  })
})

describe('useEquipmentLoadout — add/remove persistence', () => {
  test('addSystem slugifies the name and appends, merging siblings', async () => {
    const pilot = makePilot({ 'mecha-companion': { systems: ['locomotion-system'], modules: [] } })
    const { store, updateFn } = makeStore(pilot)
    const { result } = renderHook(() => useEquipmentLoadout(PILOT_ID, SLUG, undefined, store))

    await act(async () => {
      result.current.addSystem('Red Laser')
    })

    expect(updateFn).toHaveBeenCalledWith('pilot', PILOT_ID, {
      equipmentLoadouts: {
        'mecha-companion': { systems: ['locomotion-system'], modules: [] },
        'survey-drone': { systems: ['red-laser'], modules: [] },
      },
    })
  })

  test('addModule appends to modules only', async () => {
    const { store, updateFn } = makeStore(makePilot())
    const { result } = renderHook(() => useEquipmentLoadout(PILOT_ID, SLUG, undefined, store))
    await act(async () => {
      result.current.addModule('Comms Module')
    })
    expect(updateFn).toHaveBeenCalledWith('pilot', PILOT_ID, {
      equipmentLoadouts: { 'survey-drone': { systems: [], modules: ['comms-module'] } },
    })
  })

  test('sequential adds accumulate (freshest-read, no stale-closure clobber)', async () => {
    const { store, getCurrent } = makeStore(makePilot())
    const { result } = renderHook(() => useEquipmentLoadout(PILOT_ID, SLUG, undefined, store))
    await act(async () => {
      result.current.addSystem('Red Laser')
    })
    await act(async () => {
      result.current.addSystem('Welding Laser')
    })
    expect(getCurrent().equipmentLoadouts?.[SLUG]?.systems).toEqual(['red-laser', 'welding-laser'])
  })

  test('removeSystem filters by index', async () => {
    const pilot = makePilot({
      'survey-drone': { systems: ['red-laser', 'welding-laser'], modules: ['comms-module'] },
    })
    const { store, updateFn } = makeStore(pilot)
    const { result } = renderHook(() =>
      useEquipmentLoadout(PILOT_ID, SLUG, pilot.equipmentLoadouts?.[SLUG], store)
    )
    await act(async () => {
      result.current.removeSystem(0)
    })
    expect(updateFn).toHaveBeenCalledWith('pilot', PILOT_ID, {
      equipmentLoadouts: {
        'survey-drone': { systems: ['welding-laser'], modules: ['comms-module'] },
      },
    })
  })
})
