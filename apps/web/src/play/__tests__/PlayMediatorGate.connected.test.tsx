import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

/**
 * Who may open the Mediator's Play screen (`/play/games/$gameId/mediate`). Signed
 * out, sign in; a
 * member who does not mediate, or a stranger, one line and the way to the
 * Game page; the Mediator, the screen under the Game's name.
 *
 * Queries are answered by name (`serverMock.ts`). The screen is stubbed.
 */

import { installServerMocks, setQueryAnswers } from '../../components/__tests__/serverMock'
import { closeRooms, serveReads } from '../../replica/__tests__/fakeRooms'

const serverMocks = await installServerMocks({
  also: {
    // Relative to `serverMock.ts`, not this file.
    '../../play/PlayMediatorCockpit': () => ({
      PlayMediatorCockpit: ({ gameName }: { gameName: string }) =>
        createElement('p', null, `Mediating ${gameName}`),
    }),
  },
})

const { PlayMediatorGate } = await import('../PlayMediatorGate')
const { SyncContext } = await import('../../replica/syncContext')

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
      <PlayMediatorGate gameId="g1" />
    </SyncContext.Provider>
  )
}

const GAME = { _id: 'g1', name: 'Reclamation of the Wastes', mediator: true, organizer: true }

describe('PlayMediatorGate', () => {
  test('signed out, there is no Game to run', () => {
    answerReads({})
    renderAs('signedOut')
    expect(screen.getByRole('heading', { name: 'Sign in to run your Game' })).toBeTruthy()
  })

  test('the Mediator gets the screen, under the Game’s name', () => {
    answerReads({ 'games.get': GAME, 'mediator.amMediator': true })
    renderAs('live')
    expect(screen.getByText('Mediating Reclamation of the Wastes')).toBeTruthy()
  })

  test('a member who does not mediate is sent back to the Game', () => {
    answerReads({ 'games.get': { ...GAME, mediator: false }, 'mediator.amMediator': false })
    renderAs('live')
    expect(screen.getByText("Only this Game's Mediator runs this screen")).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to Game' }).getAttribute('href')).toBe(
      '/play/games/g1'
    )
  })

  test('a stranger is told the same, and the Mediator check is never asked', () => {
    answerReads({ 'games.get': null })
    renderAs('live')
    expect(screen.getByText("Only this Game's Mediator runs this screen")).toBeTruthy()
  })

  test('waits while the Game has not answered', () => {
    answerReads({ 'games.get': undefined })
    renderAs('offline')
    expect(screen.getByText('Loading the Game…')).toBeTruthy()
  })
})

/** Answer the Convex reads, and serve the Game room's records from the table reads among them. */
function answerReads(answers: Record<string, unknown>): void {
  setQueryAnswers(answers)
  serveReads('g1', answers)
}

afterEach(closeRooms)
