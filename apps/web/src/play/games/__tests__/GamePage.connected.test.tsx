import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

/**
 * Who may open a Game's page (`/play/games/$gameId`, ADR-052 §5), in each
 * storage mode: signed out, sign in; connecting, a beat; offline, a line and
 * the way to the Hangar; connected, the page itself (`GameHub`, stubbed: its
 * own file pins what it shows).
 *
 * Queries are answered by name (`convexMock.ts`).
 */

import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'

const convexMocks = await installConvexMocks({
  also: {
    // Relative to `convexMock.ts`, not this file.
    '../../play/games/GameHub': () => ({
      GameHub: ({ gameId }: { gameId: string }) =>
        createElement('p', null, `The page of ${gameId}`),
    }),
  },
})

const { GamePage } = await import('../GamePage')
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
      <GamePage gameId="g1" />
    </ConnectionContext.Provider>
  )
}

describe('GamePage', () => {
  test('signed out, it asks for a sign-in, under Play’s band', () => {
    setQueryAnswers({})
    renderAs('solo')
    expect(screen.getByRole('heading', { name: 'Sign in to open this Game' })).toBeTruthy()
    expect(screen.queryByText(/The page of/)).toBeNull()
  })

  test('connecting, it waits for the session', () => {
    setQueryAnswers({})
    renderAs('connecting')
    expect(screen.getByText(/your session/)).toBeTruthy()
  })

  test('offline, it says so and points at the Hangar', () => {
    setQueryAnswers({})
    renderAs('disconnected')
    expect(
      screen.getByRole('heading', { name: 'This Game opens once you are back online' })
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to Hangar' }).getAttribute('href')).toBe('/')
  })

  test('connected, it is the Game’s page', () => {
    setQueryAnswers({})
    renderAs('connected')
    expect(screen.getByText('The page of g1')).toBeTruthy()
  })
})
