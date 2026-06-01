/**
 * PilotSheet — editable conditions tests (W2-3, #254)
 *
 * Asserts that:
 *   1. Existing conditions render as chips.
 *   2. Adding a condition via the "+ Add" affordance calls store.update with
 *      { conditions: [...existing, new] }.
 *   3. Removing a condition calls store.update with the condition filtered out.
 *   4. readOnly: chips render but no add/remove affordance, store.update unused.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { PilotSheet } from '../PilotSheet'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePilot: Pilot = {
  id: 'pilot-cond-1',
  schemaVersion: 1,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  rollResults: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  currentHP: 10,
  currentAP: 4,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
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

describe('PilotSheet — conditions display (#254)', () => {
  test('renders existing conditions as chips', () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Exposed', 'Impaired'] }
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expect(screen.getByText('Exposed')).toBeTruthy()
    expect(screen.getByText('Impaired')).toBeTruthy()
  })

  test('shows "None" empty state with no conditions', () => {
    render(<PilotSheet pilot={basePilot} store={makeStubStore(basePilot)} />)
    expect(screen.getByText('None')).toBeTruthy()
  })
})

describe('PilotSheet — adding conditions (#254)', () => {
  test('adding a condition calls store.update with appended conditions', async () => {
    const updateSpy = mock(async () => basePilot)
    render(<PilotSheet pilot={basePilot} store={makeStubStore(basePilot, updateSpy)} />)

    const addButton = screen.getByRole('button', { name: /add condition/i })
    await act(async () => {
      fireEvent.click(addButton)
    })

    const input = screen.getByRole('textbox', { name: /new condition/i })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Exposed' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', basePilot.id, { conditions: ['Exposed'] })
  })

  test('appends to existing conditions rather than replacing', async () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Impaired'] }
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    const addButton = screen.getByRole('button', { name: /add condition/i })
    await act(async () => {
      fireEvent.click(addButton)
    })

    const input = screen.getByRole('textbox', { name: /new condition/i })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Exposed' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      conditions: ['Impaired', 'Exposed'],
    })
  })

  test('does not add a blank condition', async () => {
    const updateSpy = mock(async () => basePilot)
    render(<PilotSheet pilot={basePilot} store={makeStubStore(basePilot, updateSpy)} />)

    const addButton = screen.getByRole('button', { name: /add condition/i })
    await act(async () => {
      fireEvent.click(addButton)
    })

    const input = screen.getByRole('textbox', { name: /new condition/i })
    await act(async () => {
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(updateSpy).not.toHaveBeenCalled()
  })

  test('does not add a case-insensitive duplicate', async () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Exposed'] }
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    const addButton = screen.getByRole('button', { name: /add condition/i })
    await act(async () => {
      fireEvent.click(addButton)
    })

    const input = screen.getByRole('textbox', { name: /new condition/i })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'exposed' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('PilotSheet — removing conditions (#254)', () => {
  test('removing a condition calls store.update with it filtered out', async () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Exposed', 'Impaired'] }
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    const removeButton = screen.getByRole('button', { name: /remove condition exposed/i })
    await act(async () => {
      fireEvent.click(removeButton)
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { conditions: ['Impaired'] })
  })
})

describe('PilotSheet — conditions readOnly (#254)', () => {
  test('renders chips but no add/remove affordance', () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Exposed'] }
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />)

    expect(screen.getByText('Exposed')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /add condition/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /remove condition/i })).toBeNull()
  })

  test('store.update is never called in readOnly mode', () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Exposed'] }
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} readOnly />)

    expect(updateSpy).not.toHaveBeenCalled()
  })
})
