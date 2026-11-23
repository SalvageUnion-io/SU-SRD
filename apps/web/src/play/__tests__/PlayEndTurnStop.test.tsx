/** r8 A7: End my turn is the stop after the actions, while it is this pilot's turn. */
import { afterAll, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'

const realScene = { ...(await import('../useScene')) }
const realTable = { ...(await import('../../replica/useTable')) }
let upNow: string | null = 'p1'
const ended: unknown[] = []
mock.module('../useScene', () => ({
  ...realScene,
  useScene: () => ({ ...realScene.useScene(null), upNow }),
}))
mock.module('../../replica/useTable', () => ({
  ...realTable,
  useTableAct: () => async (args: unknown) => {
    ended.push(args)
    return null
  },
}))
afterAll(() => {
  mock.module('../useScene', () => realScene)
  mock.module('../../replica/useTable', () => realTable)
})

const { PlayEndTurnStop } = await import('../PlayEndTurnStop')
const { SyncContext } = await import('../../replica/syncContext')

function renderStop() {
  const live = { status: 'live' as const, canWrite: true, outdated: false }
  return render(
    <SyncContext.Provider value={live}>
      <PlayEndTurnStop gameId="g1" pilotId="p1" />
    </SyncContext.Provider>
  )
}

describe('PlayEndTurnStop', () => {
  test('on this pilot’s turn, one press ends it', async () => {
    upNow = 'p1'
    renderStop()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'End my turn' }))
    })
    expect(ended).toHaveLength(1)
  })

  test('on anyone else’s turn there is nothing to press', () => {
    upNow = 'p2'
    const { container } = renderStop()
    expect(container.querySelector('button')).toBeNull()
  })
})
