/**
 * U-6 — destroyed-undo toast tests.
 *
 * Cycling an item's status badge onto 'destroyed' persists the change (the
 * player stays in control per ADR-007) AND fires a toast whose Undo action
 * restores the previous condition. The Toaster (sonner) is mounted alongside
 * the sheet, mirroring the app-wide mount in routes/__root.tsx.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Toaster, toast } from 'component-lib'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { must } from '../../__tests__/must'
import { MechSheet } from '../MechSheet'

afterEach(() => {
  // Sonner's toast state is module-global — clear it so toasts never leak
  // between tests (other suites fire destroyedUndoToast without a Toaster).
  toast.dismiss()
  cleanup()
})

const SYSTEM_SLUG = 'buzz-saw'

const fakeMech: Mech = {
  id: 'mech-undo-1',
  schemaVersion: 1,
  name: 'Undo Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [SYSTEM_SLUG],
  modules: [],
  cargoLots: [],
  conditions: [],
  // One click on the badge cycles damaged → destroyed.
  systemConditions: { [SYSTEM_SLUG]: 'damaged' },
  currentSP: 10,
  currentHeat: 2,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 12,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 3,
  moduleSlots: 2,
  cargoCapacity: 4,
}

type CapturedUpdate = { id: string; patch: Partial<Mech> }

function makeStore(mech: Mech, captured: CapturedUpdate[]): typeof useEntityStore {
  let current = mech
  const updateMock = mock(async (_type: string, id: string, patch: Partial<Mech>) => {
    captured.push({ id, patch })
    current = { ...current, ...patch }
    return current
  })
  return makeEntityStoreMock({
    mechs: [mech],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [current]),
    get: mock((_type: string, id: string) => (id === current.id ? current : null)),
    create: mock(async () => mech),
    update: updateMock,
    delete: mock(async () => {}),
  })
}

describe('MechSheet — destroyed-undo toast (U-6)', () => {
  test('cycling onto destroyed persists, toasts, and Undo restores the previous condition', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <>
        <Toaster />
        <MechSheet mech={fakeMech} chassis={fakeChassis} store={makeStore(fakeMech, captured)} />
      </>
    )

    // The status badge is the only 'damaged'-styled button on the item card.
    const badge = screen.getByRole('button', { name: /damaged/i })
    await act(async () => {
      fireEvent.click(badge)
    })

    // The destructive write went through immediately (player-driven).
    expect(captured.length).toBe(1)
    expect(must(captured[0]).patch.systemConditions?.[SYSTEM_SLUG]).toBe('destroyed')

    // Toast with an Undo action fired — scope the Undo lookup to THIS toast
    // (sonner state is global; other toasts must never satisfy the assertion).
    const toastText = await screen.findByText(/marked Destroyed/i)
    const toastEl = toastText.closest('[data-sonner-toast]') as HTMLElement
    const undoBtn = within(toastEl).getByRole('button', { name: /undo/i })

    await act(async () => {
      fireEvent.click(undoBtn)
    })

    expect(captured.length).toBe(2)
    expect(must(captured[1]).patch.systemConditions?.[SYSTEM_SLUG]).toBe('damaged')
  })

  test('cycling onto damaged fires no toast', async () => {
    const captured: CapturedUpdate[] = []
    const intactMech: Mech = { ...fakeMech, systemConditions: {} }
    render(
      <>
        <Toaster />
        <MechSheet
          mech={intactMech}
          chassis={fakeChassis}
          store={makeStore(intactMech, captured)}
        />
      </>
    )

    const badge = screen.getByRole('button', { name: /intact/i })
    await act(async () => {
      fireEvent.click(badge)
    })

    expect(must(captured[0]).patch.systemConditions?.[SYSTEM_SLUG]).toBe('damaged')
    expect(screen.queryByText(/marked Destroyed/i)).toBeNull()
  })
})
