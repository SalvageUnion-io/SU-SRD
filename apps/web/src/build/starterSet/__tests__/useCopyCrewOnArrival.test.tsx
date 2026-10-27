import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

/**
 * Arriving with `?copy=crew` (or `?copy=quickstart`) signed in offers that
 * crew's copy into the Training Bay once; signed out, or with any other
 * `?copy=`, nothing is offered.
 */

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { installServerMocks } from '../../../components/__tests__/serverMock'
import type { Confirm } from '../../../components/shared/useConfirm'
import type { SyncState } from '../../../replica/syncContext'

const serverMocks = await installServerMocks()

const { SyncContext } = await import('../../../replica/syncContext')
const { hydrateStores } = await import('../../../components/__tests__/hydrateStores')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { withSignedInBackend } = await import('../../../replica/__tests__/signedInBackend')
const { useUnits } = await import('../../../replica/units')
const { copyCrewSearch, useCopyCrewOnArrival } = await import('../useCopyCrewOnArrival')

withSignedInBackend()

afterAll(() => serverMocks.restore())

beforeEach(async () => {
  resetStores()
  await hydrateStores()
})

const LIVE: SyncState = { status: 'live', canWrite: true, outdated: false }
const SIGNED_OUT: SyncState = { status: 'signedOut', canWrite: true, outdated: false }

function arrive(copy: string | undefined, sync: SyncState) {
  const asked: Parameters<Confirm>[0][] = []
  const confirm: Confirm = (request) => {
    asked.push(request)
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
  )
  const hook = renderHook(() => useCopyCrewOnArrival(copy, confirm), { wrapper })
  return { asked, hook }
}

describe('useCopyCrewOnArrival', () => {
  test('?copy=crew signed in asks once, and the yes copies the crew to the Training Bay', async () => {
    const { asked, hook } = arrive(copyCrewSearch('starter-set'), LIVE)
    hook.rerender()
    expect(asked).toHaveLength(1)
    expect(asked[0]?.title).toBe('Copy the whole crew?')
    await act(async () => {
      await asked[0]?.onConfirm()
    })
    expect(useUnits.getState().list('pilot').length).toBeGreaterThan(0)
  })

  test('?copy=quickstart asks about the Quickstart crew', () => {
    const { asked } = arrive(copyCrewSearch('quickstart'), LIVE)
    expect(asked).toHaveLength(1)
    expect(String(asked[0]?.body)).toContain('Quickstart')
  })

  test('signed out, or any other ?copy=, offers nothing', () => {
    expect(arrive('crew', SIGNED_OUT).asked).toHaveLength(0)
    expect(arrive('something-else', LIVE).asked).toHaveLength(0)
    expect(arrive(undefined, LIVE).asked).toHaveLength(0)
  })
})
