/**
 * MechSheet — interactive system/module cards (Slice A).
 *
 * Mech systems and modules used to render as plain `<span>{slug}</span>` rows.
 * They now resolve to their reference entity and render via
 * ReferenceEntityDisplay (compact, choices hidden), with the ConditionToggle
 * moved into the card.
 *
 * Asserts:
 *   1. A choice-free system resolves and renders as a card (name + a stat).
 *   2. Its in-card condition toggle still persists via store.update.
 *   3. An unresolvable slug falls back to plain text (no crash) and its toggle
 *      still persists.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), no mock.module(),
 * dep-injected store.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechSheet } from '../MechSheet'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'

// MechSheet resolves system/module slugs against the reference data at render.
beforeAll(async () => {
  await SalvageUnionReference.preload(['systems', 'modules'])
})

afterEach(() => {
  cleanup()
})

// A real, choice-free system. ".50 Cal Machine Gun" is TL1 and renders with a
// recognisable name + a "Tech Level" stat in the compact display.
const REAL_SYSTEM = '.50 Cal Machine Gun'

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 14,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 3,
  moduleSlots: 2,
  cargoCapacity: 4,
}

const fakeMech: Mech = {
  id: 'mech-cards-1',
  schemaVersion: 1,
  name: 'Card Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [REAL_SYSTEM],
  modules: ['totally-not-a-real-module'],
  cargo: [],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
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

describe('MechSheet — interactive system cards (Slice A)', () => {
  test('a choice-free system renders as a card with its name and a stat', () => {
    render(<MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStubStore(fakeMech)} />)

    // Name (from the reference entity, not the bare slug span).
    expect(screen.getByText(REAL_SYSTEM)).toBeTruthy()
    // A stat surfaced by the compact ReferenceEntityDisplay.
    expect(screen.getByText('Tech Level')).toBeTruthy()
  })

  test('the in-card condition toggle still persists via store.update', async () => {
    const updateSpy = mock(async () => fakeMech)
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStubStore(fakeMech, updateSpy)} />
    )

    const toggle = screen.getByRole('button', {
      name: new RegExp(`${REAL_SYSTEM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} condition`, 'i'),
    })
    await act(async () => {
      fireEvent.click(toggle)
    })

    expect(updateSpy).toHaveBeenCalledWith('mech', fakeMech.id, {
      systemConditions: { [REAL_SYSTEM]: 'damaged' },
    })
  })

  test('an unresolvable module slug falls back to plain text and still toggles', async () => {
    const updateSpy = mock(async () => fakeMech)
    render(
      <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStubStore(fakeMech, updateSpy)} />
    )

    // Fallback: the raw slug text is rendered (no crash).
    expect(screen.getByText('totally-not-a-real-module')).toBeTruthy()

    const toggle = screen.getByRole('button', {
      name: /totally-not-a-real-module condition/i,
    })
    await act(async () => {
      fireEvent.click(toggle)
    })

    expect(updateSpy).toHaveBeenCalledWith('mech', fakeMech.id, {
      moduleConditions: { 'totally-not-a-real-module': 'damaged' },
    })
  })
})
