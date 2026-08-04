/**
 * Pilot conditions tests (W2-3, #254 — plan 4.4)
 *
 * Conditions live in the pilot hero as the Conditions inset (design §4.2), so
 * these tests render the full Sheet (pilot branch) rather than the body-only
 * PilotSheet.
 *
 * Asserts that:
 *   1. Existing conditions render as chips.
 *   2. Adding a condition via the "+ Add" affordance calls store.update with
 *      { conditions: [...existing, new] }.
 *   3. Removing a condition calls store.update with the condition filtered out.
 *   4. readOnly: chips render but no add/remove affordance, store.update unused.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'
import {
  makeEntityLookupMock,
  makeEntityStoreMock,
  makeSoftLinkStoreMock,
} from '../../__tests__/mockEntityStore'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import type { EntityLookup } from '../Sheet'
import { Sheet } from '../Sheet'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

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

function makeEntityStore(pilot: Pilot): EntityLookup {
  return makeEntityLookupMock([pilot])
}

function makeSoftLinkStore(): SoftLinkStore {
  return makeSoftLinkStoreMock()
}

function renderPilotSheet(pilot: Pilot, updateSpy?: ReturnType<typeof mock>, readOnly = false) {
  return render(
    <Sheet
      kind="pilot"
      id={pilot.id}
      entityStore={makeEntityStore(pilot)}
      softLinkStore={makeSoftLinkStore()}
      store={makeStubStore(pilot, updateSpy)}
      readOnly={readOnly}
    />
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pilot sheet — conditions display (#254)', () => {
  test('renders existing conditions as chips in the hero inset', () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Exposed', 'Impaired'] }
    renderPilotSheet(pilot)
    expect(screen.getByText('Exposed')).toBeTruthy()
    expect(screen.getByText('Impaired')).toBeTruthy()
  })

  test('shows "None" empty state with no conditions', () => {
    renderPilotSheet(basePilot)
    expect(screen.getByText('None')).toBeTruthy()
  })
})

describe('Pilot sheet — adding conditions (#254)', () => {
  test('adding a condition calls store.update with appended conditions', async () => {
    const updateSpy = mock(async () => basePilot)
    renderPilotSheet(basePilot, updateSpy)

    const addButton = screen.getByRole('button', { name: /add condition/i })
    await act(async () => {
      fireEvent.click(addButton)
    })

    const input = screen.getByRole('textbox', { name: /new condition/i })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Exposed' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      basePilot.id,
      {
        conditions: ['Exposed'],
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('appends to existing conditions rather than replacing', async () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Impaired'] }
    const updateSpy = mock(async () => pilot)
    renderPilotSheet(pilot, updateSpy)

    const addButton = screen.getByRole('button', { name: /add condition/i })
    await act(async () => {
      fireEvent.click(addButton)
    })

    const input = screen.getByRole('textbox', { name: /new condition/i })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Exposed' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        conditions: ['Impaired', 'Exposed'],
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('does not add a blank condition', async () => {
    const updateSpy = mock(async () => basePilot)
    renderPilotSheet(basePilot, updateSpy)

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
    renderPilotSheet(pilot, updateSpy)

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

describe('Pilot sheet — removing conditions (#254)', () => {
  test('removing a condition calls store.update with it filtered out', async () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Exposed', 'Impaired'] }
    const updateSpy = mock(async () => pilot)
    renderPilotSheet(pilot, updateSpy)

    const removeButton = screen.getByRole('button', {
      name: /remove condition exposed/i,
    })
    await act(async () => {
      fireEvent.click(removeButton)
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        conditions: ['Impaired'],
      },
      LIVE_SHEET_MANUAL
    )
  })
})

describe('Pilot sheet — conditions readOnly (#254)', () => {
  test('renders chips but no add/remove affordance', () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Exposed'] }
    renderPilotSheet(pilot, undefined, true)

    expect(screen.getByText('Exposed')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /add condition/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /remove condition/i })).toBeNull()
  })

  test('store.update is never called in readOnly mode', () => {
    const pilot: Pilot = { ...basePilot, conditions: ['Exposed'] }
    const updateSpy = mock(async () => pilot)
    renderPilotSheet(pilot, updateSpy, true)

    expect(updateSpy).not.toHaveBeenCalled()
  })
})
