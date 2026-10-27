import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

/**
 * Who may open a Game's page (`/play/games/$gameId`, ADR-052 §5), in each
 * storage status: signed out, sign in; connecting, a beat; offline, a line and
 * the way to the Training Bay; connected, the page itself (`GameHub`, stubbed: its
 * own file pins what it shows).
 *
 * Queries are answered by name (`serverMock.ts`).
 */

import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'

const serverMocks = await installServerMocks({
  also: {
    // Relative to `serverMock.ts`, not this file.
    '../../play/games/GameHub': () => ({
      GameHub: ({ gameId }: { gameId: string }) =>
        createElement('p', null, `The page of ${gameId}`),
    }),
  },
})

const { GamePage } = await import('../GamePage')
const { SyncContext } = await import('../../../replica/syncContext')

afterAll(serverMocks.restore)

type Mode = 'signedOut' | 'syncing' | 'live' | 'offline'

function renderAs(status: Mode) {
  const state = {
    status,
    canWrite: status === 'live',
    outdated: false,
  }
  return render(
    <SyncContext.Provider value={state}>
      <GamePage gameId="g1" />
    </SyncContext.Provider>
  )
}

describe('GamePage', () => {
  test('signed out, it asks for a sign-in, under Play’s band', () => {
    setQueryAnswers({})
    renderAs('signedOut')
    expect(screen.getByRole('heading', { name: 'Sign in to open this Game' })).toBeTruthy()
    expect(screen.queryByText(/The page of/)).toBeNull()
  })

  test('connecting, it waits for the session', () => {
    setQueryAnswers({})
    renderAs('syncing')
    expect(screen.getByText(/your session/)).toBeTruthy()
  })

  test('offline, it says so and points at the Training Bay', () => {
    setQueryAnswers({})
    renderAs('offline')
    expect(
      screen.getByRole('heading', { name: 'This Game opens once you are back online' })
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to Training Bay' }).getAttribute('href')).toBe(
      '/'
    )
  })

  test('connected, it is the Game’s page', () => {
    setQueryAnswers({})
    renderAs('live')
    expect(screen.getByText('The page of g1')).toBeTruthy()
  })
})
