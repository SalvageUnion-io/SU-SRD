import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'

/**
 * The masthead's account controls.
 *
 * What these pin, per session state:
 *
 * - **Signed in, Connected** — the trigger is a menu button carrying the
 *   player's display name and avatar circle; its menu holds Settings (to
 *   `/settings`) and Sign out, then About, Changelog and Suggest or report. The Games menu is the Union
 *   bar's nav control (`HeaderGames`), not part of the account slot.
 * - **Signed in, offline** — the identity stays and Sign out still works, but
 *   there is no Games menu: a Disconnected player cannot list their Games.
 * - **Signed out** — "Sign in with Discord" takes the slot, on desktop and in
 *   the mobile drawer; the mobile header row stays empty.
 */

import type { QueryAnswers } from '../../../components/__tests__/serverMock'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import {
  accountAnswers,
  accountApiStub,
  resetAccountApi,
} from '../../../lib/account/__tests__/accountApiStub'

let authed = true
const signIn = mock((_route?: string) => undefined)
const signOut = mock(async () => undefined)

// Module scope, before the imports below — see `serverMock.ts`. The session
// module is mocked through `also` rather than `authReact` so the two actions
// are spies this file can read. `also` resolves from `serverMock.ts`.
const serverMocks = await installServerMocks({
  router: true,
  authReact: { useSession: () => ({ isAuthenticated: authed, isLoading: false }) },
  also: {
    '../../lib/auth/session': () => ({ signIn, signOut }),
    '../../lib/account/accountApi': accountApiStub,
  },
})

const { HeaderActions, HeaderDrawerAccount, HeaderGames, HeaderMobileActions } = await import(
  '../HeaderAccount'
)
const { SyncProvider } = await import('../../../replica/SyncProvider')
const { resetSync } = await import('../../../replica/sync')

const ME = { _id: 'u1', displayName: 'Beefcake', avatarUrl: null, email: null }
const GAMES = [{ _id: 'g1', name: 'Union Crawler #430', mediator: true, organizer: true }]

const QUERIES: QueryAnswers = { 'games.listMine': GAMES }

/** The Games list from the server, and the player from the account route. */
function serve(queries: QueryAnswers): void {
  setQueryAnswers(queries)
  accountAnswers.me = ME
}

/** Force the browser's online flag, which is what picks Connected vs Disconnected. */
function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

const wrap = (ui: ReactNode) => render(<SyncProvider>{ui}</SyncProvider>)

/** Open a `HeaderMenu` from its trigger and hand back the menu. */
async function openMenu(trigger: HTMLElement): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(trigger)
  })
  return screen.getByRole('menu')
}

afterEach(() => {
  authed = true
  setOnline(true)
  signIn.mockClear()
  signOut.mockClear()
  serverMocks.navigations.length = 0
  // Process-global: a leaked signed-in state changes what later files exercise.
  resetSync()
  resetAccountApi()
})

afterAll(serverMocks.restore)

describe('signed in and connected', () => {
  test('the trigger is a menu button showing the display name and avatar initials', () => {
    serve(QUERIES)
    wrap(<HeaderActions />)

    const trigger = screen.getByRole('button', { name: 'Account menu for Beefcake' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.textContent).toContain('Beefcake')
    // No avatar URL: the chip falls back to the initials.
    expect(trigger.textContent).toContain('BE')
  })

  test('its menu holds Settings and Sign out, then About, Changelog and Suggest or report', async () => {
    serve(QUERIES)
    wrap(<HeaderActions />)

    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Settings', 'Sign out', 'About', 'Changelog', 'Suggest or report'])
  })

  test('Settings goes to /settings', async () => {
    serve(QUERIES)
    wrap(<HeaderActions />)

    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Settings' }))
    })
    expect(serverMocks.navigations).toEqual([{ to: '/settings' }])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  test('Sign out signs out', async () => {
    serve(QUERIES)
    wrap(<HeaderActions />)

    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    })
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  test('the Games menu is a nav control, not part of the account slot', () => {
    serve(QUERIES)
    wrap(<HeaderActions />)

    expect(screen.getByRole('button', { name: 'Account menu for Beefcake' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Games' })).toBeNull()
    // The old sub-header's plain buttons are gone from this slot.
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Account' })).toBeNull()
  })

  test('the nav Games control is a menu button', () => {
    serve(QUERIES)
    wrap(<HeaderGames />)

    expect(screen.getByRole('button', { name: 'Games' }).getAttribute('aria-haspopup')).toBe('menu')
  })

  test('mobile: the header row shows the avatar alone, still naming the account', () => {
    serve(QUERIES)
    wrap(<HeaderMobileActions />)

    const trigger = screen.getByRole('button', { name: 'Account menu for Beefcake' })
    expect(trigger.textContent).not.toContain('Beefcake')
  })

  test('mobile: in Play the drawer lists the Games rather than offering sign-in', () => {
    serve(QUERIES)
    wrap(<HeaderDrawerAccount close={() => {}} pathname="/play/" />)

    expect(screen.getByRole('navigation', { name: 'Games' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
  })

  test('mobile: in Build the drawer has no Games, which left Build', () => {
    serve(QUERIES)
    const { container } = wrap(<HeaderDrawerAccount close={() => {}} pathname="/" />)
    expect(container.innerHTML).toBe('')
  })

  test('the nav Games control is current on the hub and a Game’s routes, nowhere else', () => {
    serve(QUERIES)
    const current = (pathname: string) => {
      const { unmount } = wrap(<HeaderGames pathname={pathname} />)
      const here = screen.getByRole('button', { name: 'Games' }).getAttribute('aria-current')
      unmount()
      return here
    }
    expect(current('/play/')).toBe('page')
    expect(current('/play/games/g1')).toBe('page')
    expect(current('/')).toBeNull()
  })

  test('before the profile arrives it reads "Account" rather than guessing a name', () => {
    serve(QUERIES)
    delete accountAnswers.me
    wrap(<HeaderActions />)

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger.textContent).toContain('Account')
  })
})

describe('signed in but offline', () => {
  test('keeps the identity and a working Sign out, with no Games menu', async () => {
    setOnline(false)
    serve(QUERIES)
    wrap(
      <>
        <HeaderGames />
        <HeaderActions />
      </>
    )

    expect(screen.queryByRole('button', { name: 'Games' })).toBeNull()
    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    })
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  test('the drawer has nothing to add', () => {
    setOnline(false)
    serve(QUERIES)
    const { container } = wrap(<HeaderDrawerAccount close={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('signed out', () => {
  test('the slot is "Sign in with Discord", and it signs in with Discord', () => {
    authed = false
    setQueryAnswers({})
    wrap(<HeaderActions />)

    expect(screen.queryByRole('button', { name: /account menu/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Games' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }))
    expect(signIn).toHaveBeenCalledTimes(1)
  })

  test('mobile: the header row stays empty and the drawer offers sign-in', () => {
    authed = false
    setQueryAnswers({})
    const row = wrap(<HeaderMobileActions />)
    expect(row.container.innerHTML).toBe('')
    row.unmount()

    wrap(<HeaderDrawerAccount close={() => {}} />)
    expect(screen.getByRole('button', { name: 'Sign in with Discord' })).toBeTruthy()
  })
})
