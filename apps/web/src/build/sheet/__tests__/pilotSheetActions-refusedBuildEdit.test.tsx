/**
 * A build edit the server refuses is told to the player, never left as an
 * unhandled rejection.
 *
 * A clean build edit saves at once through `useSoftWarnings().saveAnyway()`.
 * Before it ran through `runWrite`, a refusal there (`WritesBlockedOffline`
 * while the Games are read-only) escaped the `void` at the call site: the
 * player's add did nothing and nothing was said.
 */

import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import { WritesBlockedOffline } from '../../../replica/sync'
import type { UnitsState } from '../../../replica/units'
import { usePilotSheetActions } from '../pilotSheetActions.model'

describe('usePilotSheetActions — a refused build edit', () => {
  test('adding an ability while writes are blocked leaves no unhandled rejection', async () => {
    const pilot = pilotFixture({ id: 'pilot-1', abilities: [] })
    let attempts = 0
    const storeState = {
      ...makeEntityStoreMock({ pilots: [pilot] }).getState(),
      get: (type: string, id: string) => (type === 'pilot' && id === pilot.id ? pilot : null),
      update: async () => {
        attempts += 1
        throw new WritesBlockedOffline()
      },
    } as unknown as UnitsState
    const store = Object.assign(() => storeState, { getState: () => storeState })

    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      const { result } = renderHook(() =>
        usePilotSheetActions({ pilot, store: store as never, storeState })
      )
      await act(async () => {
        result.current.toggleAbility('scavenge')
      })
      // One macrotask, so a rejection with no handler has been reported.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(attempts).toBe(1)
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})
