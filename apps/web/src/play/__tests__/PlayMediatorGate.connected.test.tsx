import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

/**
 * Who may open the Mediator's Play screen (`/play/games/$gameId/mediate`). Signed
 * out, sign in; a
 * member who does not mediate, or a stranger, one line and the way to the
 * Game page; the Mediator, the screen under the Game's name.
 *
 * Queries are answered by name (`convexMock.ts`). The screen is stubbed.
 */

import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'

const convexMocks = await installConvexMocks({
  also: {
    // Relative to `convexMock.ts`, not this file.
    '../../play/PlayMediatorCockpit': () => ({
      PlayMediatorCockpit: ({ gameName }: { gameName: string }) =>
        createElement('p', null, `Mediating ${gameName}`),
    }),
  },
})

const { PlayMediatorGate } = await import('../PlayMediatorGate')
const { SyncContext } = await import('../../replica/syncContext')

afterAll(convexMocks.restore)

type Mode = 'signedOut' | 'syncing' | 'live' | 'offline'

function renderAs(status: Mode) {
  const state = {
    status,
    canWrite: status === 'live',
    outdated: false,
  }
  return render(
    <SyncContext.Provider value={state}>
      <PlayMediatorGate gameId="g1" />
    </SyncContext.Provider>
  )
}

const GAME = { _id: 'g1', name: 'Reclamation of the Wastes', mediator: true, organizer: true }

describe('PlayMediatorGate', () => {
  test('signed out, there is no Game to run', () => {
    setQueryAnswers({})
    renderAs('signedOut')
    expect(screen.getByRole('heading', { name: 'Sign in to run your Game' })).toBeTruthy()
  })

  test('the Mediator gets the screen, under the Game’s name', () => {
    setQueryAnswers({ 'games:get': GAME, 'mediator:amMediator': true })
    renderAs('live')
    expect(screen.getByText('Mediating Reclamation of the Wastes')).toBeTruthy()
  })

  test('a member who does not mediate is sent back to the Game', () => {
    setQueryAnswers({ 'games:get': { ...GAME, mediator: false }, 'mediator:amMediator': false })
    renderAs('live')
    expect(screen.getByText("Only this Game's Mediator runs this screen")).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to Game' }).getAttribute('href')).toBe(
      '/play/games/g1'
    )
  })

  test('a stranger is told the same, and the Mediator check is never asked', () => {
    setQueryAnswers({ 'games:get': null })
    renderAs('live')
    expect(screen.getByText("Only this Game's Mediator runs this screen")).toBeTruthy()
  })

  test('waits while the Game has not answered', () => {
    setQueryAnswers({ 'games:get': undefined })
    renderAs('offline')
    expect(screen.getByText('Loading the Game…')).toBeTruthy()
  })
})
