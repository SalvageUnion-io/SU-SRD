import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'

/**
 * `GameScreen` — one Game, connected.
 *
 * Two things are worth defending here. Invite management belongs to the
 * Organizer, and showing it to anyone else would be offering a control the
 * server will refuse. And `games.get` returning `null` means "not a member",
 * which must read as an explanation rather than a crash — a bookmarked URL for
 * a Game you left is an ordinary thing to visit.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import type { QueryAnswers } from '../../__tests__/convexMock'

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
// `router` because the panels link out; nothing here asserts on navigation.
const convexMocks = await installConvexMocks({ router: true })

const { GameScreen } = await import('../GameScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

function withQueries(answers: QueryAnswers): void {
  setQueryAnswers(answers)
}

const wrap = () =>
  render(
    <ConnectionProvider>
      <GameScreen gameId="g1" />
    </ConnectionProvider>
  )

const GAME = {
  _id: 'g1',
  name: 'Union Crawler #430',
  templateOrigin: undefined,
  mediator: false,
  organizer: false,
  memberCount: 3,
  crawlerName: 'Hamlet',
  pilotCount: 4,
  mechCount: 3,
}

/**
 * Everything downstream of `games.get`: GameRoster's account.me /
 * games.members / entities.listForGame, the invite panel's two queries, the
 * proposal inbox and the Downtime panel. Only `games:get` varies between
 * these tests.
 */
const REST: QueryAnswers = {
  'account:me': { _id: 'u1', displayName: 'Ash' },
  'games:members': [],
  'entities:listForGame': { pilots: [], mechs: [], crawlers: [], softLinks: [] },
  'invites:list': [],
  'invites:pendingRequests': [],
  'proposals:pending': [],
  'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
  'mediator:amMediator': false,
}

afterEach(cleanup)

describe('GameScreen', () => {
  test('a plain member gets no invite management', () => {
    withQueries({ ...REST, 'games:get': GAME })
    wrap()

    // The server refuses a non-Organizer's invites.list outright, so offering
    // the panel here would be a control that only ever errors.
    expect(screen.queryByText('Create invite code')).toBeNull()
    expect(screen.queryByLabelText('Invite note')).toBeNull()
  })

  test('every panel states its name in its header band', () => {
    // A pending proposal, so the inbox renders at all (it returns null when
    // there is nothing to answer).
    withQueries({
      ...REST,
      'games:get': { ...GAME, organizer: true },
      'proposals:pending': [{ _id: 'p1', entityType: 'pilot', field: 'currentHP', to: 3 }],
    })
    wrap()

    // These titles used to sit inside each panel's body as a small grey stamp.
    // They are the Card's header now, and `Invite someone` in particular
    // changed OWNER in that move — it is rendered by GameScreen, not by
    // InvitePanel — so nothing else would catch it going missing.
    // Queried by ROLE, not by text: these are section headings, and a screen
    // reader navigating the Game surface should find them as such. They were
    // spans until the a11y pass; `getByRole` is what stops them regressing to
    // one.
    expect(screen.getByRole('heading', { level: 2, name: 'Invite someone' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Awaiting your answer' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Downtime' })).toBeTruthy()
    // …under the page's h1, over the roster columns' h3s. No level is skipped.
    expect(screen.getByRole('heading', { level: 1, name: 'Game' })).toBeTruthy()
  })

  test('an Organizer gets invite management', () => {
    withQueries({ ...REST, 'games:get': { ...GAME, organizer: true } })
    wrap()

    expect(screen.getByText('Create invite code')).toBeTruthy()
    expect(screen.getByLabelText('Invite note')).toBeTruthy()
    expect(screen.getByLabelText('Invite seat')).toBeTruthy()
    expect(screen.getByLabelText('Require approval')).toBeTruthy()
  })

  test('a game you are not in explains itself instead of crashing', () => {
    withQueries({ ...REST, 'games:get': null })
    wrap()

    expect(screen.getByText(/not in this game/i)).toBeTruthy()
    expect(screen.queryByText('Create invite code')).toBeNull()
  })

  test('still loading is not the same as not a member', () => {
    withQueries({ ...REST, 'games:get': undefined })
    wrap()

    expect(screen.getByText(/Loading this game/i)).toBeTruthy()
    expect(screen.queryByText(/not in this game/i)).toBeNull()
  })
})

afterAll(convexMocks.restore)
