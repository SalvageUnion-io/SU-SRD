/**
 * PilotSheet — editable HP/AP stat tests (#245)
 *
 * Asserts that:
 *   1. Editing HP calls store.update with { currentHP: <value> }
 *   2. Editing AP calls store.update with { currentAP: <value> }
 *   3. readOnly suppresses editing (no spinbutton, no store.update)
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

const fakePilot: Pilot = {
  id: 'pilot-edit-1',
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

describe('PilotSheet — HP editing (#245)', () => {
  test('renders HP stat value', () => {
    render(<PilotSheet pilot={fakePilot} store={makeStubStore(fakePilot)} />)
    expect(screen.getByText('10')).toBeTruthy()
  })

  test('clicking HP value enters edit mode (shows spinbutton)', async () => {
    render(<PilotSheet pilot={fakePilot} store={makeStubStore(fakePilot)} />)
    const hpValue = screen.getByText('10')
    await act(async () => {
      fireEvent.click(hpValue)
    })
    expect(screen.getByRole('spinbutton')).toBeTruthy()
  })

  test('saving HP calls store.update with { currentHP }', async () => {
    const updateSpy = mock(async () => fakePilot)
    render(<PilotSheet pilot={fakePilot} store={makeStubStore(fakePilot, updateSpy)} />)

    const hpValue = screen.getByText('10')
    await act(async () => {
      fireEvent.click(hpValue)
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '7' } })
      fireEvent.blur(input)
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', fakePilot.id, { currentHP: 7 })
  })
})

describe('PilotSheet — AP editing (#245)', () => {
  test('renders AP stat value', () => {
    render(<PilotSheet pilot={fakePilot} store={makeStubStore(fakePilot)} />)
    expect(screen.getByText('4')).toBeTruthy()
  })

  test('saving AP calls store.update with { currentAP }', async () => {
    // Use a pilot where HP and AP are different so we can distinguish them
    const updateSpy = mock(async () => fakePilot)
    render(<PilotSheet pilot={fakePilot} store={makeStubStore(fakePilot, updateSpy)} />)

    // Click the AP value (4)
    const apValue = screen.getByText('4')
    await act(async () => {
      fireEvent.click(apValue)
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '2' } })
      fireEvent.blur(input)
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', fakePilot.id, { currentAP: 2 })
  })
})

describe('PilotSheet — readOnly (#245)', () => {
  test('no edit buttons (role=button with "Edit" label) when readOnly', () => {
    render(<PilotSheet pilot={fakePilot} store={makeStubStore(fakePilot)} readOnly />)
    // No edit buttons should be present — readOnly renders plain text
    const editButtons = document.querySelectorAll('button[aria-label*="Edit"]')
    expect(editButtons.length).toBe(0)
  })

  test('clicking stat value does not show spinbutton when readOnly', async () => {
    render(<PilotSheet pilot={fakePilot} store={makeStubStore(fakePilot)} readOnly />)
    const hpValue = screen.getByText('10')
    await act(async () => {
      fireEvent.click(hpValue)
    })
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  test('store.update is never called when readOnly', async () => {
    const updateSpy = mock(async () => fakePilot)
    render(<PilotSheet pilot={fakePilot} store={makeStubStore(fakePilot, updateSpy)} readOnly />)

    const hpValue = screen.getByText('10')
    await act(async () => {
      fireEvent.click(hpValue)
    })

    expect(updateSpy).not.toHaveBeenCalled()
  })
})
