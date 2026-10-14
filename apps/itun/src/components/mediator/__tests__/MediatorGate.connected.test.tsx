import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

/**
 * Who may open the Mediator Dashboard, in each storage mode
 * (docs/architecture/mediator-dashboard.md Q3): signed out gets the
 * player Dashboard's signed-out answer; a member who does not mediate, or a
 * stranger, gets one line and the way to the Game page; the Mediator gets the
 * surface — offline included, where it opens on what was last read with its
 * controls disabled.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import { createElement } from 'react'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

const convexMocks = await installConvexMocks({
  also: {
    // Relative to `convexMock.ts`, not this file. Whether the gate opens it,
    // and for which Game, is all these tests need of the surface.
    '../mediator/MediatorDashboard': () => ({
      MediatorDashboard: ({ gameName }: { gameName: string }) =>
        createElement('p', null, `Running ${gameName}`),
    }),
  },
})

const { MediatorGate } = await import('../MediatorGate')
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
      <MediatorGate gameId="g1" />
    </ConnectionContext.Provider>
  )
}

const GAME = { _id: 'g1', name: 'Reclamation of the Wastes', mediator: true, organizer: true }

describe('MediatorGate', () => {
  test('signed out, there is no Game to run', () => {
    setQueryAnswers({})
    renderAs('solo')
    expect(screen.getByText('Sign in to run your Game')).toBeTruthy()
  })

  test('the Mediator gets the surface', () => {
    setQueryAnswers({ 'games:get': GAME, 'mediator:amMediator': true })
    renderAs('connected')
    expect(screen.getByText('Running Reclamation of the Wastes')).toBeTruthy()
  })

  test('a member who does not mediate gets one line and the way back, and no controls', () => {
    setQueryAnswers({ 'games:get': { ...GAME, mediator: false }, 'mediator:amMediator': false })
    renderAs('connected')
    expect(screen.getByText("Only this Game's Mediator runs this screen")).toBeTruthy()
    expect(screen.getByRole('link', { name: '← Back to the Game' }).getAttribute('href')).toBe(
      '/games/g1'
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  test('a stranger reads the same line: the gate tells them nothing about the Game', () => {
    setQueryAnswers({ 'games:get': null })
    renderAs('connected')
    expect(screen.getByText("Only this Game's Mediator runs this screen")).toBeTruthy()
  })

  test('offline, the Mediator keeps the surface on what was last read', () => {
    setQueryAnswers({ 'games:get': GAME, 'mediator:amMediator': true })
    renderAs('disconnected')
    expect(screen.getByText('Running Reclamation of the Wastes')).toBeTruthy()
  })

  test('opened cold offline, it waits rather than guessing', () => {
    setQueryAnswers({ 'games:get': undefined })
    renderAs('disconnected')
    expect(screen.queryByText(/Running/)).toBeNull()
    expect(screen.getByText(/Loading the Game/i)).toBeTruthy()
  })
})
