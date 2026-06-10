/**
 * MechSheet — readOnly prop tests (#242)
 *
 * When readOnly is true (e.g. in SnapshotView), stat cells must render as
 * plain text — no role=button, no click-to-edit, no store.update calls.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MechSheet } from '../MechSheet'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeMech: Mech = {
  id: 'mech-snapshot-1',
  schemaVersion: 1,
  name: 'Snapshot Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  currentHP: 12,
  currentAP: 3,
  currentTP: 1,
  currentSP: 8,
  currentEP: 5,
  currentHeat: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 14,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 3,
  moduleSlots: 2,
  cargoCapacity: 4,
}

function makeStubStore(mech: Mech, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => mech)
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
// Tests
// ---------------------------------------------------------------------------

describe('MechSheet — readOnly', () => {
  test('stat values render as plain text (no role=button) when readOnly', () => {
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStubStore(fakeMech)} readOnly />
    )

    // No buttons should be present for stat editing
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('clicking a stat cell does not enter edit mode when readOnly', async () => {
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStubStore(fakeMech)} readOnly />
    )

    // The HP value is rendered as plain text — find it
    const hpValue = screen.getByText('12')
    await act(async () => {
      fireEvent.click(hpValue)
    })

    // No input/spinbutton should appear
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  test('store.update is never called when readOnly and stat cells are clicked', async () => {
    const updateSpy = mock(async () => fakeMech)
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeStubStore(fakeMech, updateSpy)}
        readOnly
      />
    )

    // Click on all numeric values visible
    const hpValue = screen.getByText('12')
    await act(async () => {
      fireEvent.click(hpValue)
    })

    expect(updateSpy).not.toHaveBeenCalled()
  })

  test('stat values are still visible as text when readOnly', () => {
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStubStore(fakeMech)} readOnly />
    )

    // All stat values should appear as text
    expect(screen.getByText('12')).toBeTruthy() // HP
    expect(screen.getByText('3')).toBeTruthy() // AP
    expect(screen.getByText('1')).toBeTruthy() // TP
    expect(screen.getByText('8')).toBeTruthy() // SP
    expect(screen.getByText('5')).toBeTruthy() // EP
    expect(screen.getByText('2')).toBeTruthy() // Heat
  })
})
