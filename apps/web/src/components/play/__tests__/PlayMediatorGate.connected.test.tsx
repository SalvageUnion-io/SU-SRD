import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

/**
 * Who may open the Mediator's Play screen (`/play/game/$gameId`). Signed
 * out, sign in; a
 * member who does not mediate, or a stranger, one line and the way to the
 * Game page; the Mediator, the screen under the Game's name.
 *
 * Queries are answered by name (`convexMock.ts`). The screen is stubbed.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

const convexMocks = await installConvexMocks({
  also: {
    // Relative to `convexMock.ts`, not this file.
    '../play/PlayMediatorCockpit': () => ({
      PlayMediatorCockpit: ({ gameName }: { gameName: string }) =>
        createElement('p', null, `Mediating ${gameName}`),
    }),
  },
})

const { PlayMediatorGate } = await import('../PlayMediatorGate')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')

afterAll(convexMocks.restore)

type Mode = 'solo' | 'connecting' | 'connected' | 'disconnected'

function renderAs(mode: Mode) {
  const state = {
    mode,
    canWrite: mode === 'connected',
    showDisconnectedWarning: mode === 'disconnected',
    settling: mode === 'connecting',
  }
  return render(
    <ConnectionContext.Provider value={state}>
      <PlayMediatorGate gameId="g1" />
    </ConnectionContext.Provider>
  )
}

const GAME = { _id: 'g1', name: 'Reclamation of the Wastes', mediator: true, organizer: true }

describe('PlayMediatorGate', () => {
  test('signed out, there is no Game to run', () => {
    setQueryAnswers({})
    renderAs('solo')
    expect(screen.getByRole('heading', { name: 'Sign in to run your Game' })).toBeTruthy()
  })

  test('the Mediator gets the screen, under the Game’s name', () => {
    setQueryAnswers({ 'games:get': GAME, 'mediator:amMediator': true })
    renderAs('connected')
    expect(screen.getByText('Mediating Reclamation of the Wastes')).toBeTruthy()
  })

  test('a member who does not mediate is sent back to the Game', () => {
    setQueryAnswers({ 'games:get': { ...GAME, mediator: false }, 'mediator:amMediator': false })
    renderAs('connected')
    expect(screen.getByText("Only this Game's Mediator runs this screen")).toBeTruthy()
    expect(screen.getByRole('link', { name: '← Back to the Game' }).getAttribute('href')).toBe(
      '/games/g1'
    )
  })

  test('a stranger is told the same, and the Mediator check is never asked', () => {
    setQueryAnswers({ 'games:get': null })
    renderAs('connected')
    expect(screen.getByText("Only this Game's Mediator runs this screen")).toBeTruthy()
  })

  test('waits while the Game has not answered', () => {
    setQueryAnswers({ 'games:get': undefined })
    renderAs('disconnected')
    expect(screen.getByText('Loading the Game…')).toBeTruthy()
  })
})
