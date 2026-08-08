/**
 * The pilot live sheet's equipment toggle IS the partner's lifecycle.
 *
 * A partner cannot outlive its grant, and no card offers to remove one on its
 * own — so unequipping the granting item is the ONLY way a pilot's drone goes
 * away, and equipping it is the only way one arrives. That makes this three-line
 * wiring the single point where a pilot partner is born or dies, which is why it
 * is pinned here rather than left to the reconciliation unit tests.
 *
 * The write must be ONE patch. Equipment and partners landing as two writes
 * would leave a window where the pilot has the drone but not the equipment that
 * justifies it (or worse, the reverse, which reads as a silently lost drone).
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { Pilot } from '../../../lib/schemas/pilot'
import { pilotFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { must } from '../../__tests__/must'
import { usePilotSheetActions } from '../pilotSheetActions'
import type { SheetStoreState } from '../sheetViewProps'

afterEach(() => {
  cleanup()
})

type Captured = { patch: Record<string, unknown> }

function setup(pilot: Pilot) {
  const captured: Captured[] = []
  const storeState = {
    ...makeEntityStoreMock({ pilots: [pilot] }).getState(),
    get: (type: string, id: string) => (type === 'pilot' && id === pilot.id ? pilot : null),
    update: async (_type: string, _id: string, patch: Record<string, unknown>) => {
      captured.push({ patch })
      return pilot
    },
  } as unknown as SheetStoreState

  const { result } = renderHook(() =>
    usePilotSheetActions({
      pilot,
      store: makeEntityStoreMock({ pilots: [pilot] }) as never,
      storeState,
    })
  )
  return { captured, result }
}

describe('toggleEquipment — the grant is the lifecycle', () => {
  test('equipping a Survey Drone grants a live partner in the SAME write', async () => {
    const pilot = pilotFixture({ id: 'pilot-1', equipment: [] })
    const { captured, result } = setup(pilot)

    await act(async () => {
      result.current.toggleEquipment('survey-drone')
    })

    expect(captured).toHaveLength(1)
    const { patch } = must(captured[0])
    expect(patch.equipment).toEqual(['survey-drone'])
    const partners = patch.partners as { hostRef: string; hostSchema: string }[]
    expect(partners).toHaveLength(1)
    expect(must(partners[0]).hostRef).toBe('survey-drone')
    expect(must(partners[0]).hostSchema).toBe('equipment')
  })

  test('unequipping it takes the drone with it', async () => {
    const pilot = pilotFixture({
      id: 'pilot-1',
      equipment: ['survey-drone'],
      partners: [
        {
          id: 'p-custos',
          hostRef: 'survey-drone',
          hostSchema: 'equipment',
          name: 'Custos',
          systems: [],
          modules: [],
          conditions: [],
        },
      ],
    })
    const { captured, result } = setup(pilot)

    await act(async () => {
      result.current.toggleEquipment('survey-drone')
    })

    const { patch } = must(captured[0])
    expect(patch.equipment).toEqual([])
    expect(patch.partners).toEqual([])
  })

  test('ordinary gear never touches partners at all', async () => {
    const pilot = pilotFixture({ id: 'pilot-1', equipment: [] })
    const { captured, result } = setup(pilot)

    await act(async () => {
      result.current.toggleEquipment('first-aid-kit')
    })

    const { patch } = must(captured[0])
    expect(patch.equipment).toEqual(['first-aid-kit'])
    // Absent, not `[]` — an unrelated toggle must not rewrite the field and
    // wipe a drone granted by something else.
    expect(patch).not.toHaveProperty('partners')
  })

  test('toggling ordinary gear leaves an existing partner alone', async () => {
    const pilot = pilotFixture({
      id: 'pilot-1',
      equipment: ['survey-drone'],
      partners: [
        {
          id: 'p-custos',
          hostRef: 'survey-drone',
          hostSchema: 'equipment',
          systems: [],
          modules: [],
          conditions: [],
        },
      ],
    })
    const { captured, result } = setup(pilot)

    await act(async () => {
      result.current.toggleEquipment('rifle')
    })

    expect(must(captured[0]).patch).not.toHaveProperty('partners')
  })

  test('the actions surface offers no partner removal of its own', () => {
    const pilot = pilotFixture({ id: 'pilot-1', equipment: [] })
    const { result } = setup(pilot)
    expect(result.current).not.toHaveProperty('removePartner')
  })
})
