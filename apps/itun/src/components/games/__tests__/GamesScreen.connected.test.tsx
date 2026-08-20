import { afterAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * `GamesScreen` in its connected state — the Games *index*.
 *
 * Since the route split this screen is only about choosing a Game: create,
 * join, and one row per table. Everything per-Game (crew, invites, roles, the
 * Mediator link) moved to `/games/$gameId`, and is covered by
 * `GameDetailScreen.connected.test.tsx`.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import type { QueryAnswers } from '../../__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

let redeemResult: unknown = { kind: 'joined', gameId: 'g9', granted: 0 }
let redeemError: Error | null = null

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
//
// `authReact` because SignInControl mounts here; `router` because rows link out
// and joining navigates — neither needs a real RouterProvider for these
// assertions, and the stub records what was navigated to.
const convexMocks = await installConvexMocks({
  authReact: true,
  router: true,
  convexReact: {
    useMutation: () => async () => {
      if (redeemError !== null) throw redeemError
      return redeemResult
    },
  },
})

const navigations = convexMocks.navigations

const { GamesScreen } = await import('../GamesScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

function withQueries(answers: QueryAnswers): void {
  setQueryAnswers(answers)
  navigations.length = 0
  redeemError = null
}

const wrap = () =>
  render(
    <ConnectionProvider>
      <GamesScreen />
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

const TEMPLATES = [
  { id: 'starter-set', name: 'Reclamation of the Wastes', description: 'Six pre-gens.' },
]

/** listMine, templates — the index's only two queries. */
function queriesFor(game: Record<string, unknown>): QueryAnswers {
  return { 'games:listMine': [game], 'templates:list': TEMPLATES }
}

describe('the Games index for a signed-in player', () => {
  test('lists a row per game', () => {
    withQueries(queriesFor(GAME))
    wrap()
    expect(screen.getByText('Union Crawler #430')).toBeTruthy()
  })

  test('the row stats say what the table is', () => {
    withQueries(queriesFor(GAME))
    wrap()

    // A Game row answers "what is this table" before you open it. These are
    // `label | value` stats in the header band now, not body badges, so the
    // label and the value are separate cells — "4 Pilots" is `PILOTS | 4`.
    expect(screen.getByText('Crawler')).toBeTruthy()
    expect(screen.getByText('Hamlet')).toBeTruthy()
    expect(screen.getByText('Pilots')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('Mechs')).toBeTruthy()
    // `3` is deliberately counted, not fetched: this game has three mechs AND
    // three members, so the bare value is ambiguous by design. Splitting a
    // label from its value is what makes it so — the trade for cells that can
    // be scanned down a column.
    expect(screen.getAllByText('3').length).toBe(2)
    expect(screen.getByText('Members')).toBeTruthy()
  })

  test('a game with nothing in it still renders all three stats', () => {
    withQueries(queriesFor({ ...GAME, crawlerName: null, pilotCount: 0, mechCount: 0 }))
    wrap()

    // Dropping the stats would make a new Game's row look broken rather than
    // empty — an absent crawler reads as a value ("None"), never as a gap.
    expect(screen.getByText('None')).toBeTruthy()
    expect(screen.getByText('Pilots')).toBeTruthy()
    expect(screen.getByText('Mechs')).toBeTruthy()
    expect(screen.getAllByText('0').length).toBe(2)
  })

  test('the row links to the game, not to a modal', () => {
    withQueries(queriesFor(GAME))
    wrap()
    expect(screen.getByText('View').getAttribute('href')).toBe('/games/g1')
  })

  test('offers create and join to everybody', () => {
    withQueries(queriesFor(GAME))
    wrap()

    expect(screen.getByLabelText('New game name')).toBeTruthy()
    expect(screen.getByLabelText('Invite code')).toBeTruthy()
  })

  test('per-game administration is NOT on the index, for anyone', () => {
    withQueries(queriesFor({ ...GAME, organizer: true, mediator: true }))
    wrap()

    // These moved to /games/$gameId. An Organizer seeing them here would mean
    // the split half-happened.
    expect(screen.queryByLabelText('Rename Union Crawler #430')).toBeNull()
    expect(screen.queryByText('Create invite code')).toBeNull()
    expect(screen.queryByText('Make Mediator')).toBeNull()
    expect(screen.queryByText(/Open the Mediator surface/)).toBeNull()
  })

  test('offers a template to start from, behind a control rather than inline', () => {
    withQueries(queriesFor(GAME))
    wrap()

    // A template is a list to READ — a name plus a paragraph each — so it sits
    // in a dialog and the controls band stays a band. Inline, it wedged a
    // screenful of prose between the controls and the games list.
    expect(screen.queryByText('Reclamation of the Wastes')).toBeNull()

    fireEvent.click(screen.getByText('From a template'))

    expect(screen.getByText('Reclamation of the Wastes')).toBeTruthy()
    expect(screen.getByText('Start this game')).toBeTruthy()
  })

  test('the creating controls come BEFORE the games they act on', () => {
    withQueries(queriesFor(GAME))
    const { container } = wrap()

    // The point of the band (this is the Roster's rhythm): what you can DO is
    // one ink-ruled row across the top, and what you HAVE lists beneath it.
    // This screen used to stack three creation Cards, so the games you came to
    // open sat below a screenful of forms you had already used.
    const text = container.textContent ?? ''
    const controls = text.indexOf('Start a game')
    const joinControl = text.indexOf('Join with a code')
    const list = text.indexOf('Union Crawler #430')

    for (const index of [controls, joinControl, list]) expect(index).toBeGreaterThan(-1)
    expect(controls).toBeLessThan(list)
    expect(joinControl).toBeLessThan(list)
  })

  test('no games yet says so, and still offers the way in', () => {
    withQueries({ 'games:listMine': [], 'templates:list': TEMPLATES })
    wrap()

    expect(screen.getByText(/not in any games yet/i)).toBeTruthy()
    expect(screen.getByLabelText('Invite code')).toBeTruthy()
  })
})

/**
 * Deleting from the index.
 *
 * The trash is the ONE per-game control that belongs on this screen, which is
 * the exception to "per-game administration is NOT on the index" above: every
 * other administrative control acts on the table's *contents* and needs the
 * table in front of you, while deleting acts on the row itself and is the
 * ordinary `EntityRow` affordance the Roster already uses for a pilot.
 */
describe('deleting a game from the index', () => {
  test('only the Organizer is offered the trash', () => {
    withQueries(queriesFor(GAME))
    wrap()
    // A Player — and, deliberately, a Mediator who is not the Organizer — has
    // no trash, because `games.destroy` would refuse them. Hiding a control the
    // server will refuse is the courtesy; the refusal is the boundary.
    expect(screen.queryByLabelText('Delete Union Crawler #430')).toBeNull()

    withQueries(queriesFor({ ...GAME, mediator: true }))
    wrap()
    expect(screen.queryByLabelText('Delete Union Crawler #430')).toBeNull()
  })

  test('the Organizer gets it', () => {
    withQueries(queriesFor({ ...GAME, organizer: true }))
    wrap()
    expect(screen.getByLabelText('Delete Union Crawler #430')).toBeTruthy()
  })

  test('the trash asks first, and says where everything lands', () => {
    withQueries(queriesFor({ ...GAME, organizer: true }))
    wrap()

    // Nothing is destroyed on click — a shared campaign ending for everyone in
    // it is the clearest case there is for a confirm.
    expect(screen.queryByText(/It cannot be undone/i)).toBeNull()

    fireEvent.click(screen.getByLabelText('Delete Union Crawler #430'))

    // The confirm's job is to be checkable against the row that opened it, so
    // it carries the real counts and the crawler's real name rather than a
    // generic "this is permanent".
    expect(screen.getByText(/It cannot be undone/i)).toBeTruthy()
    expect(screen.getByText(/4 pilots and 3 mechs go back to the shelves/i)).toBeTruthy()
    expect(screen.getByText(/Hamlet and anything unclaimed land on your shelf/i)).toBeTruthy()
  })

  test('a game with no crawler does not promise one', () => {
    withQueries(queriesFor({ ...GAME, organizer: true, crawlerName: null, pilotCount: 0 }))
    wrap()
    fireEvent.click(screen.getByLabelText('Delete Union Crawler #430'))

    expect(screen.getByText(/^Anything unclaimed lands on your shelf\.$/)).toBeTruthy()
    // With no pilots there is no "0 pilots" line to read past.
    expect(screen.queryByText(/0 pilots/)).toBeNull()
  })

  test('cancelling leaves the game alone', () => {
    withQueries(queriesFor({ ...GAME, organizer: true }))
    wrap()

    fireEvent.click(screen.getByLabelText('Delete Union Crawler #430'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText(/It cannot be undone/i)).toBeNull()
    expect(screen.getByText('Union Crawler #430')).toBeTruthy()
  })
})

describe('joining by code from the lobby', () => {
  test('a successful join routes into the game it joined', async () => {
    withQueries(queriesFor(GAME))
    wrap()

    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'A1B2C3D4' } })
    fireEvent.click(screen.getByText('Join'))

    await waitFor(() => expect(navigations).toHaveLength(1))
    expect(navigations[0]).toMatchObject({ params: { gameId: 'g9' } })
  })

  test('a gated code says it is waiting instead of routing nowhere', async () => {
    withQueries(queriesFor(GAME))
    redeemResult = { kind: 'pending', gameId: 'g9' }
    wrap()

    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'A1B2C3D4' } })
    fireEvent.click(screen.getByText('Join'))

    await waitFor(() => expect(screen.getByText(/once the organizer approves/i)).toBeTruthy())
    // Routing into a Game you cannot yet see would be the wrong reassurance.
    expect(navigations).toHaveLength(0)
    redeemResult = { kind: 'joined', gameId: 'g9', granted: 0 }
  })

  test('a refusal is shown in the server’s own words', async () => {
    withQueries(queriesFor(GAME))
    wrap()
    redeemError = new Error('That invite code has expired')

    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'A1B2C3D4' } })
    fireEvent.click(screen.getByText('Join'))

    await waitFor(() => expect(screen.getByText(/has expired/)).toBeTruthy())
  })

  test('Join is disabled until a code is typed', () => {
    withQueries(queriesFor(GAME))
    wrap()
    expect((screen.getByText('Join') as HTMLButtonElement).disabled).toBe(true)
  })
})

afterAll(convexMocks.restore)
