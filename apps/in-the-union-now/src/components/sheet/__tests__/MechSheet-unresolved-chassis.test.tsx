/**
 * MechSheet — unresolved chassis tests (#243)
 *
 * When chassis cannot be resolved (null), the stat block must still render
 * with fallback to stored values (or 0), and an accessible notice must appear.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'

import { MechSheet } from '../MechSheet'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeMechNoStoredValues: Mech = {
  id: 'mech-unresolved-1',
  schemaVersion: 1,
  name: 'Ghost Frame',
  chassisRef: 'nonexistent-chassis-xyz',
  systems: [],
  modules: [],
  cargo: [],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeMechWithStoredValues: Mech = {
  id: 'mech-unresolved-2',
  schemaVersion: 1,
  name: 'Stored Frame',
  chassisRef: 'nonexistent-chassis-xyz',
  systems: [],
  modules: [],
  cargo: [],
  conditions: [],
  currentHP: 7,
  currentAP: 3,
  currentTP: 2,
  currentSP: 5,
  currentEP: 4,
  currentHeat: 6,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeStubStore(mech: Mech): typeof useEntityStore {
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
    update: mock(async () => mech) as any,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MechSheet — unresolved chassis (chassis=null)', () => {
  test('renders all six stat rows even when chassis is null', () => {
    render(
      <MechSheet
        mech={fakeMechNoStoredValues}
        chassis={null}
        store={makeStubStore(fakeMechNoStoredValues)}
      />
    )

    // The stats section heading should appear
    expect(screen.getByText('Stats')).toBeTruthy()

    // Each of the six stat labels must be present (getAllByText because the label
    // appears in both the <dt> and the EditableStatRow's internal <span>).
    expect(screen.getAllByText('HP').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('AP').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('TP').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('SP').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('EP').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Heat').length).toBeGreaterThanOrEqual(1)
  })

  test('stat rows are editable (role=button present) when chassis is null', () => {
    render(
      <MechSheet
        mech={fakeMechNoStoredValues}
        chassis={null}
        store={makeStubStore(fakeMechNoStoredValues)}
      />
    )

    // EditableStatRow renders a button in display mode
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(6)
  })

  test('shows accessible notice referencing the unresolvable chassisRef', () => {
    render(
      <MechSheet
        mech={fakeMechNoStoredValues}
        chassis={null}
        store={makeStubStore(fakeMechNoStoredValues)}
      />
    )

    // The notice must mention the bogus chassis ref
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('nonexistent-chassis-xyz')
  })

  test('stat rows fall back to stored values when chassis is null', () => {
    render(
      <MechSheet
        mech={fakeMechWithStoredValues}
        chassis={null}
        store={makeStubStore(fakeMechWithStoredValues)}
      />
    )

    // The stored HP value (7) should appear somewhere in the document
    const allText = document.body.textContent ?? ''
    expect(allText).toContain('7')
  })

  test('stat rows default to 0 when chassis is null and no stored values', () => {
    render(
      <MechSheet
        mech={fakeMechNoStoredValues}
        chassis={null}
        store={makeStubStore(fakeMechNoStoredValues)}
      />
    )

    // With no stored values and no chassis, all stats should show 0
    // EditableStatRow renders the value as text in the button label
    const buttons = screen.getAllByRole('button')
    // At least one button should display "0"
    const zeroButtons = buttons.filter((btn) => btn.textContent?.trim() === '0')
    expect(zeroButtons.length).toBeGreaterThanOrEqual(6)
  })
})
