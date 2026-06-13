/**
 * Unit tests for useEntityChoices.
 *
 * Tests that:
 * - selections come from the `seed` param (sourced by callers from the canonical
 *   entity prop), falling back to a stable empty object when absent
 * - setSelections persists via store.update, MERGING the per-item map so sibling
 *   items' choices are preserved (not clobbered)
 * - setSelections reads the FRESHEST field map from the store (stale-closure guard)
 *
 * Uses dep-injection exclusively — NO mock.module().
 */

import '@testing-library/jest-dom'
import { describe, expect, mock, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'

import { useEntityChoices } from '../useEntityChoices'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PILOT_ID = 'pilot-choices-1'

function makePilot(equipmentChoices?: Pilot['equipmentChoices']): Pilot {
  return {
    id: PILOT_ID,
    schemaVersion: 1,
    name: 'Test Pilot',
    callsign: 'Tester',
    classRef: 'scavenger',
    abilities: [],
    equipment: ['custom-sniper-rifle', 'auto-turret'],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    equipmentChoices,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

// ---------------------------------------------------------------------------
// Stub factory — builds a minimal injectable store with a mutable backing entity.
// get() always returns the FRESHEST entity so the stale-closure guard is exercised.
// ---------------------------------------------------------------------------

function makeStore(initial: Pilot) {
  // Mutable cell so update() can mutate and a later get() returns the fresh value.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: mock((_type: string, id: string) => (id === current.id ? current : null)) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => current) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateFn as any,
    delete: mock(async () => {}),
  }

  const store = (() => storeState) as unknown as typeof useEntityStore
  return { store, updateFn, getCurrent: () => current }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useEntityChoices — seeding', () => {
  test('seeds {} (stable empty) when no seed is provided', () => {
    const { store } = makeStore(makePilot())
    const { result, rerender } = renderHook(() =>
      useEntityChoices(
        'pilot',
        PILOT_ID,
        'custom-sniper-rifle',
        'equipmentChoices',
        undefined,
        store
      )
    )
    expect(result.current.selections).toEqual({})
    // The empty reference is stable across renders so it does not defeat the
    // downstream React.memo on ReferenceEntityDisplay.
    const first = result.current.selections
    rerender()
    expect(result.current.selections).toBe(first)
  })

  test('returns the seed selections verbatim', () => {
    const seed = { 'choice-weapon-type': ['Energy'] }
    const { store } = makeStore(makePilot())
    const { result } = renderHook(() =>
      useEntityChoices('pilot', PILOT_ID, 'custom-sniper-rifle', 'equipmentChoices', seed, store)
    )
    expect(result.current.selections).toBe(seed)
  })
})

describe('useEntityChoices — setSelections persistence', () => {
  test('persists the next selections for this item via store.update', async () => {
    const { store, updateFn } = makeStore(makePilot())
    const { result } = renderHook(() =>
      useEntityChoices(
        'pilot',
        PILOT_ID,
        'custom-sniper-rifle',
        'equipmentChoices',
        undefined,
        store
      )
    )

    await act(async () => {
      result.current.setSelections({ 'choice-weapon-type': ['Ballistic'] })
    })

    expect(updateFn).toHaveBeenCalledTimes(1)
    expect(updateFn).toHaveBeenCalledWith('pilot', PILOT_ID, {
      equipmentChoices: {
        'custom-sniper-rifle': { 'choice-weapon-type': ['Ballistic'] },
      },
    })
  })

  test('merges into the per-item map without clobbering sibling items', async () => {
    const pilot = makePilot({
      'auto-turret': { 'choice-name': ['Sentinel'] },
    })
    const { store, updateFn } = makeStore(pilot)
    const { result } = renderHook(() =>
      useEntityChoices(
        'pilot',
        PILOT_ID,
        'custom-sniper-rifle',
        'equipmentChoices',
        undefined,
        store
      )
    )

    await act(async () => {
      result.current.setSelections({ 'choice-weapon-type': ['Energy'] })
    })

    expect(updateFn).toHaveBeenCalledWith('pilot', PILOT_ID, {
      equipmentChoices: {
        'auto-turret': { 'choice-name': ['Sentinel'] },
        'custom-sniper-rifle': { 'choice-weapon-type': ['Energy'] },
      },
    })
  })

  test('reads the freshest field map from the store (stale-closure guard)', async () => {
    // Start with no choices; a sibling item's choice is written to the store
    // AFTER the hook renders, simulating a concurrent edit elsewhere.
    const { store, updateFn, getCurrent } = makeStore(makePilot())
    const { result } = renderHook(() =>
      useEntityChoices(
        'pilot',
        PILOT_ID,
        'custom-sniper-rifle',
        'equipmentChoices',
        undefined,
        store
      )
    )

    // Simulate a concurrent write to a sibling item through the same store.
    await store().update('pilot', PILOT_ID, {
      equipmentChoices: { 'auto-turret': { 'choice-name': ['Sentinel'] } },
    })

    // Now this item's setSelections must merge against the FRESH map, not the
    // empty render-time snapshot.
    await act(async () => {
      result.current.setSelections({ 'choice-weapon-type': ['Energy'] })
    })

    const lastCall = updateFn.mock.calls[updateFn.mock.calls.length - 1]
    expect(lastCall?.[2]).toEqual({
      equipmentChoices: {
        'auto-turret': { 'choice-name': ['Sentinel'] },
        'custom-sniper-rifle': { 'choice-weapon-type': ['Energy'] },
      },
    })
    expect(getCurrent().equipmentChoices).toEqual({
      'auto-turret': { 'choice-name': ['Sentinel'] },
      'custom-sniper-rifle': { 'choice-weapon-type': ['Energy'] },
    })
  })
})
