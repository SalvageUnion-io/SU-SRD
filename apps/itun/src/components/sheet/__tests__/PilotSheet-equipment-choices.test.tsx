/**
 * PilotSheet — pilot equipment choice persistence tests.
 *
 * Asserts that:
 *   1. A choice-bearing pilot equipment item renders its choice cards
 *      (e.g. Custom Sniper Rifle → "Weapon Type" with Ballistic / Energy).
 *   2. Toggling a choice persists to the store via update() under
 *      equipmentChoices[slug][choiceId], without clobbering other items.
 *   3. Persisted selections render as already-chosen (aria-pressed).
 *   4. readOnly: choice cards render but toggling does not call store.update.
 *
 * Uses the store-injection seam + a real choice-bearing reference equipment.
 * NO mock.module().
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Pilot } from '../../../lib/schemas/pilot'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'
import { expandCards } from '../../__tests__/expandCards'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { PilotSheet } from '../PilotSheet'

// PilotSheet resolves equipment slugs via salvageunion-reference at render, and
// the choice cards deep-link trait/keyword entities — preload 'all' so those
// nested lookups (TraitKeywordDisplayView) resolve.
//
// SNIPER_ID is resolved from the reference (not hardcoded) so the fixture keys
// pilot.equipment and equipmentChoices by the equipment's real production id —
// the same key PilotWizard/EquipmentStep persist (onToggle(item.id)) — rather
// than the display name.
beforeAll(async () => {
  await SalvageUnionReference.preload('all')
  const sniper = SalvageUnionReference.Equipment.all().find((e) => e.name === SNIPER_NAME)
  if (!sniper) throw new Error(`Fixture setup: equipment "${SNIPER_NAME}" not found in reference`)
  SNIPER_ID = sniper.id
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Constants — Custom Sniper Rifle carries a "Weapon Type" permanent choice with
// Ballistic / Energy schema-entity options. The choice id is stable in the
// dataset; the options render as buttons labelled with their entity name.
// SNIPER_ID is the equipment's real id (resolved in beforeAll) — the persistence
// key used in production.
// ---------------------------------------------------------------------------

const SNIPER_NAME = 'Custom Sniper Rifle'
const WEAPON_TYPE_CHOICE_ID = 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a'
let SNIPER_ID = ''

// ---------------------------------------------------------------------------
// Store stub — mutable backing entity so get() returns fresh state after update.
// ---------------------------------------------------------------------------

function makePilotStubStore(initial: Pilot, updateSpy?: ReturnType<typeof mock>) {
  let current = initial
  const updateMock =
    updateSpy ??
    mock(async (_type: string, _id: string, patch: Partial<Pilot>) => {
      current = { ...current, ...patch }
      return current
    })

  const store = makeEntityStoreMock({
    pilots: [current],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [current]),
    get: mock((_type: string, id: string) => (id === current.id ? current : null)),
    create: mock(async () => current),
    update: updateMock,
    delete: mock(async () => {}),
  })
  return { store, updateMock }
}

// Empty store — get() always returns null, mirroring a share-link viewer who
// does NOT own the snapshot's pilot locally. Used to prove selections are
// sourced from the pilot prop, not the live store.
function makeEmptyStore() {
  const updateMock = mock(async () => {
    throw new Error('update should not be called in read-only snapshot')
  })
  const store = makeEntityStoreMock({
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => []),
    get: mock(() => null),
    create: mock(async () => null),
    update: updateMock,
    delete: mock(async () => {}),
  })
  return { store, updateMock }
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makePilot(overrides?: Partial<Pilot>): Pilot {
  return {
    id: 'pilot-choices-1',
    schemaVersion: 1,
    name: 'Zara Quinn',
    callsign: 'Hex',
    classRef: 'scavenger',
    abilities: [],
    equipment: [SNIPER_ID],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PilotSheet — equipment choice cards', () => {
  test('renders choice option cards for a choice-bearing equipment', () => {
    const pilot = makePilot()
    const { store } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} />)
    expandCards()

    // The Weapon Type options render as toggle buttons.
    expect(screen.getByRole('button', { name: /Ballistic/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Energy/i })).toBeTruthy()
  })

  test('toggling a choice persists to equipmentChoices[slug][choiceId]', async () => {
    const pilot = makePilot()
    const { store, updateMock } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} />)
    expandCards()

    const ballistic = screen.getByRole('button', { name: /Ballistic/i })
    await act(async () => {
      fireEvent.click(ballistic)
    })

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        equipmentChoices: {
          [SNIPER_ID]: { [WEAPON_TYPE_CHOICE_ID]: ['Ballistic'] },
        },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('persisted selection renders as chosen (aria-pressed)', () => {
    const pilot = makePilot({
      equipmentChoices: {
        [SNIPER_ID]: { [WEAPON_TYPE_CHOICE_ID]: ['Energy'] },
      },
    })
    const { store } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} />)
    expandCards()

    const energy = screen.getByRole('button', { name: /Energy/i })
    expect(energy.getAttribute('aria-pressed')).toBe('true')

    const ballistic = screen.getByRole('button', { name: /Ballistic/i })
    expect(ballistic.getAttribute('aria-pressed')).toBe('false')
  })

  test('readOnly snapshot: persisted selection renders from the pilot prop even when the store has no entity', () => {
    // Mirrors the share-link case: the viewer does not own this pilot locally,
    // so the store get() returns null. Selections must come from the pilot prop.
    const pilot = makePilot({
      equipmentChoices: {
        [SNIPER_ID]: { [WEAPON_TYPE_CHOICE_ID]: ['Energy'] },
      },
    })
    const { store } = makeEmptyStore()
    render(<PilotSheet pilot={pilot} store={store} readOnly />)
    expandCards()

    const energy = screen.getByRole('button', { name: /Energy/i })
    expect(energy.getAttribute('aria-pressed')).toBe('true')

    const ballistic = screen.getByRole('button', { name: /Ballistic/i })
    expect(ballistic.getAttribute('aria-pressed')).toBe('false')
  })

  test('readOnly: choice cards render but toggling does not persist', async () => {
    const pilot = makePilot()
    const { store, updateMock } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} readOnly />)
    expandCards()

    const ballistic = screen.getByRole('button', { name: /Ballistic/i })
    expect(ballistic).toBeTruthy()

    await act(async () => {
      fireEvent.click(ballistic)
    })

    expect(updateMock).not.toHaveBeenCalled()
  })
})
