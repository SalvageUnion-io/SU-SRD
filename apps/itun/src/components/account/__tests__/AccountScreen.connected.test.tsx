import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'

/**
 * `AccountScreen` for somebody who has an account.
 *
 * Holding a person's Discord identity creates obligations — show it, let them
 * correct it, let them take their data, let them erase it — and this is where
 * all four are honoured. The tests below are about those obligations, not about
 * layout: that deletion cannot happen on one click, that the export button is
 * not offered before there is anything to export, and that a blank display name
 * falls back to the Discord one rather than to nothing.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 * Name-keying also retires the modulo wrap the positional queue needed: a
 * state change re-renders and replays the same hooks, which used to run off
 * the end of the queue and collapse the screen back to its loading state.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import type { QueryAnswers } from '../../__tests__/convexMock'

let authed = true

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
// `authReact` because the profile mounts `SignInControl`.
const convexMocks = await installConvexMocks({
  authReact: true,
  convexReact: { useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }) },
})

const { AccountScreen } = await import('../AccountScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

function withQueries(answers: QueryAnswers): void {
  setQueryAnswers(answers)
}

/** The three the profile asks for; `exported` is what most cases vary. */
function profileQueries(
  me: unknown,
  games: unknown = GAMES,
  exported: unknown = { pilots: [] }
): QueryAnswers {
  return { 'account:me': me, 'games:listMine': games, 'account:exportMine': exported }
}

/** Force the browser's online flag, which is what picks Connected vs Disconnected. */
function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  authed = true
  setOnline(true)
})

const wrap = () =>
  render(
    <ConnectionProvider>
      <AccountScreen />
    </ConnectionProvider>
  )

const ME = { displayName: 'Beefcake', avatarUrl: null, discordId: 'd1' }
const GAMES = [
  { _id: 'g1', name: 'Union Crawler #430', mediator: true, organizer: true, memberCount: 4 },
  { _id: 'g2', name: 'The Long Haul', mediator: false, organizer: false, memberCount: 1 },
]

describe('what the account page is when there is no account', () => {
  test('solo says the data is safe here and offers the way in', () => {
    authed = false
    withQueries({})
    wrap()

    // Solo is a supported way to use the app, not a degraded one — the copy
    // has to say so rather than nagging.
    expect(screen.getByText(/You are playing solo/i)).toBeTruthy()
    expect(screen.getByText(/needs no account/i)).toBeTruthy()
  })

  test('disconnected explains it rather than showing a broken profile form', () => {
    setOnline(false)
    withQueries({})
    wrap()

    expect(screen.getByText(/unreachable right now/i)).toBeTruthy()
    // Offering an editable name that cannot be saved would be a lie.
    expect(screen.queryByLabelText('Display name')).toBeNull()
  })
})

describe('the profile', () => {
  test('while it loads it says so', () => {
    withQueries(profileQueries(undefined))
    wrap()
    expect(screen.getByText(/Loading your account/i)).toBeTruthy()
  })

  test('a signed-in session with no row says so plainly', () => {
    withQueries(profileQueries(null))
    wrap()
    expect(screen.getByText('No account found.')).toBeTruthy()
  })

  test('the display name is pre-filled from Discord', () => {
    withQueries(profileQueries(ME))
    wrap()

    const input = screen.getByLabelText('Display name') as HTMLInputElement
    expect(input.value).toBe('Beefcake')
  })

  test('a null display name renders as empty, not as the string null', () => {
    withQueries(profileQueries({ ...ME, displayName: null }))
    wrap()
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('')
  })
})

describe('your games, seen from the account page', () => {
  test('each game names your role in it', () => {
    withQueries(profileQueries(ME))
    wrap()

    expect(screen.getByText('Union Crawler #430')).toBeTruthy()
    // Organizer is orthogonal to Mediator, so both can be true at once.
    expect(screen.getByText(/Organizer · Mediator · 4 members/)).toBeTruthy()
    expect(screen.getByText(/^Player · 1 member$/)).toBeTruthy()
  })

  test('no games says so rather than rendering an empty card', () => {
    withQueries(profileQueries(ME, []))
    wrap()
    expect(screen.getByText(/not in any games yet/i)).toBeTruthy()
  })
})

describe('taking your data, and taking it away', () => {
  test('download is refused until the export has actually arrived', () => {
    // Clicking it early would hand somebody an empty file and call it their data.
    // Explicit rather than via profileQueries: a default parameter cannot
    // express "still loading", since `undefined` is what triggers the default.
    withQueries({ ...profileQueries(ME), 'account:exportMine': undefined })
    wrap()
    expect(screen.getByText('Download my data').closest('button')?.disabled).toBe(true)
  })

  test('once the export is ready the button is live', () => {
    withQueries(profileQueries(ME))
    wrap()
    expect(screen.getByText('Download my data').closest('button')?.disabled).toBe(false)
  })

  test('deletion takes two deliberate clicks, and says what survives', () => {
    withQueries(profileQueries(ME))
    wrap()

    // The first click only arms it; nothing irreversible is one click away.
    expect(screen.queryByText('Permanently delete')).toBeNull()
    fireEvent.click(screen.getByText('Delete my account'))
    expect(screen.getByText('Permanently delete')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })

  test('it warns that the shared game outlives the account', () => {
    withQueries(profileQueries(ME))
    wrap()
    // A crawler is communal; deleting yourself must not delete the table's game.
    expect(screen.getByText(/Games you are in survive/i)).toBeTruthy()
  })
})

afterAll(convexMocks.restore)
