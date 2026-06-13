/**
 * PilotSheet — Injuries slab (plan 4.4, rules A2/A11)
 *
 * Asserts that:
 *   1. Adding a minor/major injury persists the severity-enum list AND clamps
 *      current HP to the recomputed derived max in the same patch.
 *   2. Removing an injury persists the filtered list.
 *   3. Severity edits persist (with clamp).
 *   4. The slab count surfaces the total max-HP penalty.
 *   5. readOnly renders the list statically with no add/remove/edit.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { PilotSheet } from '../PilotSheet'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-inj-1',
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
// Tests
// ---------------------------------------------------------------------------

describe('PilotSheet — adding injuries (rules A11)', () => {
  test('adding a minor injury persists the list and clamps current HP to the new max', async () => {
    const pilot = makePilot({ currentHP: 10 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add minor injury' }))
    })

    // maxHP drops 10 → 9; currentHP 10 clamps to 9 in the SAME patch
    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      injuries: [{ severity: 'minor', note: '' }],
      currentHP: 9,
    })
  })

  test('adding a major injury clamps by 2', async () => {
    const pilot = makePilot({ currentHP: 10 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add major injury' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      injuries: [{ severity: 'major', note: '' }],
      currentHP: 8,
    })
  })

  test('no clamp key when current HP is already under the new max', async () => {
    const pilot = makePilot({ currentHP: 4 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add minor injury' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      injuries: [{ severity: 'minor', note: '' }],
    })
  })
})

describe('PilotSheet — editing and removing injuries', () => {
  test('removing an injury persists the filtered list', async () => {
    const pilot = makePilot({
      currentHP: 9,
      injuries: [{ severity: 'minor', note: 'sprained wrist' }],
    })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove injury 1' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { injuries: [] })
  })

  test('changing severity persists (minor → major, with clamp)', async () => {
    const pilot = makePilot({
      currentHP: 9,
      injuries: [{ severity: 'minor', note: 'sprained wrist' }],
    })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Injury 1 severity' }), {
        target: { value: 'major' },
      })
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      injuries: [{ severity: 'major', note: 'sprained wrist' }],
      currentHP: 8,
    })
  })

  test('slab count shows the total max-HP penalty', () => {
    const pilot = makePilot({
      injuries: [
        { severity: 'minor', note: '' },
        { severity: 'major', note: '' },
      ],
    })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expect(screen.getByText('−3 max HP')).toBeTruthy()
  })
})

describe('PilotSheet — injuries readOnly', () => {
  test('static list, no add/remove/edit affordances', () => {
    const pilot = makePilot({
      injuries: [{ severity: 'major', note: 'shrapnel' }],
    })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />)

    expect(screen.getByText('shrapnel')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /add minor injury/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /add major injury/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /remove injury/i })).toBeNull()
    expect(screen.queryByRole('combobox', { name: /severity/i })).toBeNull()
  })
})
