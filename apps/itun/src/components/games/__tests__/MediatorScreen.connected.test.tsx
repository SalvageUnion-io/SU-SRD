import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

/**
 * `MediatorScreen` in its connected state.
 *
 * The Solo test proves the screen refuses gracefully with no account. This
 * covers the surface itself: that it is gated on actually mediating, and that
 * the propose form obeys the one rule that is easy to lose — you may only
 * propose to an entity that has somebody to answer.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 * This screen is the strongest argument for that: it renders ten `useQuery`
 * calls across six panels, two of them (`crew.vitals`, `mediator.amMediator`)
 * asked twice by different components, so under the old positional queue
 * inserting a panel shifted every later answer silently.
 */

import type { QueryAnswers } from '../../__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
const convexMocks = await installConvexMocks()

const { MediatorScreen } = await import('../MediatorScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

function withQueries(answers: QueryAnswers): void {
  setQueryAnswers(answers)
}

const wrap = () =>
  render(
    <ConnectionProvider>
      <MediatorScreen gameId="g1" />
    </ConnectionProvider>
  )

const CLAIMED_PILOT = {
  _id: 'p1',
  appId: null,
  ownerId: 'u2',
  ownerName: 'Beefcake',
  name: 'Roach-Boy',
  currentHP: 8,
  currentAP: 4,
}

const UNCLAIMED_PILOT = {
  _id: 'p2',
  appId: null,
  ownerId: null,
  ownerName: null,
  name: 'Pre-gen',
  currentHP: 10,
  currentAP: 5,
}

const DOWNTIME = { running: false, stepIndex: null, completedBy: [], upkeepSpent: false }

/** The signed-in viewer, as `account.me` returns them. */
const ME = { _id: 'u1', displayName: 'Mediator', avatarUrl: null, email: null }

/** This game's roster, as `games.members` returns it. */
const MEMBERS = [
  { userId: 'u1', displayName: 'Mediator', mediator: true, organizer: true },
  { userId: 'u2', displayName: 'Beefcake', mediator: false, organizer: false },
]

/** An empty crew listing, as `entities.listForGame` returns one. */
const EMPTY_LISTING = { pilots: [], mechs: [], crawlers: [], softLinks: [] }

/** The full mediating render, with whatever crew and tray the case needs. */
function mediatingQueries(
  crew: Record<string, unknown>,
  extra: {
    alerts?: unknown
    npcs?: unknown
    members?: unknown
    listing?: unknown
  } = {}
): QueryAnswers {
  return {
    'mediator:amMediator': true,
    // The crew roster leads the surface: who I am, who is in this game, and
    // what the game holds.
    'account:me': ME,
    'games:members': extra.members ?? MEMBERS,
    'entities:listForGame': extra.listing ?? EMPTY_LISTING,
    // Asked twice — by CrewVitals and by the propose form — and both readers
    // want the same answer.
    'crew:vitals': crew,
    'proposals:alerts': extra.alerts ?? [],
    'downtime:state': DOWNTIME,
    'mediator:npcs': extra.npcs ?? [],
  }
}

describe('who the Mediator surface is for', () => {
  test('somebody who does not mediate is told so, and gets none of the tools', () => {
    withQueries({ 'mediator:amMediator': false })
    wrap()

    expect(screen.getByText(/You do not mediate this game/i)).toBeTruthy()
    // The refusal has to be total: a visible propose form that the server would
    // reject is worse than no form.
    expect(screen.queryByLabelText('Proposal target')).toBeNull()
    expect(screen.queryByLabelText('Alert message')).toBeNull()
    expect(screen.queryByLabelText('NPC name')).toBeNull()
  })

  test('while the role is still unknown it says so rather than guessing', () => {
    // Rendering the tools optimistically would flash the whole Mediator surface
    // at a player who is about to be refused it.
    withQueries({ 'mediator:amMediator': undefined })
    wrap()
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  test('the Mediator gets every panel', () => {
    withQueries(mediatingQueries({ viewerId: 'u1', pilots: [CLAIMED_PILOT], mechs: [] }))
    wrap()

    expect(screen.getByText('Propose a change')).toBeTruthy()
    expect(screen.getByText('Tell the table')).toBeTruthy()
    expect(screen.getByText('Opposition')).toBeTruthy()
  })
})

describe('proposing a change', () => {
  test('only claimed entities are offered as targets', () => {
    withQueries(
      mediatingQueries({
        viewerId: 'u1',
        pilots: [CLAIMED_PILOT, UNCLAIMED_PILOT],
        mechs: [],
      })
    )
    wrap()

    // An unclaimed pre-gen has nobody to answer the proposal, so offering it
    // would build a dead end into the form.
    expect(screen.getByRole('option', { name: 'Roach-Boy (pilot)' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Pre-gen (pilot)' })).toBeNull()
  })

  test('mechs are offered alongside pilots, labelled by kind', () => {
    withQueries(
      mediatingQueries({
        viewerId: 'u1',
        pilots: [],
        mechs: [{ ...CLAIMED_PILOT, _id: 'm1', name: 'Iron Mongrel' }],
      })
    )
    wrap()
    expect(screen.getByRole('option', { name: 'Iron Mongrel (mech)' })).toBeTruthy()
  })

  test('it says out loud that it is asking, not setting', () => {
    // The propose/confirm rule is the whole point of the surface; if the
    // wording ever drifts to sounding authoritative, this should fail.
    withQueries(mediatingQueries({ viewerId: 'u1', pilots: [], mechs: [] }))
    wrap()
    expect(screen.getByText(/You are asking, not setting/i)).toBeTruthy()
  })

  test('Propose stays disabled until there is a target and a value', () => {
    withQueries(mediatingQueries({ viewerId: 'u1', pilots: [CLAIMED_PILOT], mechs: [] }))
    wrap()

    const button = screen.getByText('Propose').closest('button')
    expect(button?.disabled).toBe(true)
  })
})

describe('the rest of the table', () => {
  test('recent alerts are shown back, and Send needs a message', () => {
    withQueries(
      mediatingQueries(
        { viewerId: 'u1', pilots: [], mechs: [] },
        { alerts: [{ _id: 'a1', message: 'The crawler is taking fire.' }] }
      )
    )
    wrap()

    expect(screen.getByText('The crawler is taking fire.')).toBeTruthy()
    expect(screen.getByText('Send').closest('button')?.disabled).toBe(true)
  })

  test('the tray is named as private, and an unnamed NPC still reads as something', () => {
    withQueries(
      mediatingQueries(
        { viewerId: 'u1', pilots: [], mechs: [] },
        {
          npcs: [
            { _id: 'n1', body: {} },
            { _id: 'n2', body: { name: 'Scrap Hound' } },
          ],
        }
      )
    )
    wrap()

    expect(screen.getByText(/Only you can see this/i)).toBeTruthy()
    // A blank row would look like a rendering bug in the middle of a session.
    expect(screen.getByText('Unnamed')).toBeTruthy()
    expect(screen.getByText('Scrap Hound')).toBeTruthy()
  })
})

afterAll(convexMocks.restore)
