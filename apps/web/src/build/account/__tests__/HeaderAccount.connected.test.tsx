import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'

/**
 * The masthead's account controls.
 *
 * What these pin, per session state:
 *
 * - **Signed in, Connected** — the trigger is a menu button carrying the
 *   player's display name and avatar circle; its menu holds the player's own
 *   places (Your Games, Training Bay), then Settings (to `/settings`) and
 *   Sign out, then About, Changelog and Suggest or report. The slot itself
 *   carries no Games button: Play is a tab of the bar (ADR-066).
 * - **Signed in, offline** — the identity stays and Sign out still works.
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
  router: 'probed',
  authReact: { useSession: () => ({ isAuthenticated: authed, isLoading: false }) },
  also: {
    '../../lib/auth/session': () => ({ signIn, signOut }),
    '../../lib/account/accountApi': accountApiStub,
  },
})

const { HeaderActions, HeaderDrawerAccount, HeaderMobileActions } = await import('../HeaderAccount')
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

  test('its menu holds Your Games and Training Bay, Settings and Sign out, then the site’s pages', async () => {
    serve(QUERIES)
    wrap(<HeaderActions />)

    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual([
      'Your Games',
      'Training Bay',
      'Settings',
      'Sign out',
      'About',
      'Changelog',
      'Suggest or report',
    ])
  })

  test('Your Games and Training Bay route in the app', async () => {
    serve(QUERIES)
    wrap(<HeaderActions />)
    for (const name of ['Your Games', 'Training Bay']) {
      const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
      await act(async () => {
        fireEvent.click(within(menu).getByRole('menuitem', { name }))
      })
    }
    expect(serverMocks.navigations).toEqual([{ to: '/games' }, { to: '/' }])
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

  test('Sign out signs out, and goes home', async () => {
    serve(QUERIES)
    wrap(<HeaderActions />)

    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    })
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(serverMocks.navigations).toEqual([{ to: '/' }])
  })

  test('the account slot carries no Games control: Games is a tab', () => {
    serve(QUERIES)
    wrap(<HeaderActions />)
    expect(screen.getByRole('button', { name: 'Account menu for Beefcake' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Games' })).toBeNull()
  })

  test('mobile: the header row shows the avatar alone, still naming the account', () => {
    serve(QUERIES)
    wrap(<HeaderMobileActions />)

    const trigger = screen.getByRole('button', { name: 'Account menu for Beefcake' })
    expect(trigger.textContent).not.toContain('Beefcake')
  })

  test('mobile: the drawer has nothing to add, signed in', () => {
    serve(QUERIES)
    const { container } = wrap(<HeaderDrawerAccount />)
    expect(container.innerHTML).toBe('')
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
  test('keeps the identity and a working Sign out', async () => {
    setOnline(false)
    serve(QUERIES)
    wrap(<HeaderActions />)

    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    })
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  test('the drawer has nothing to add', () => {
    setOnline(false)
    serve(QUERIES)
    const { container } = wrap(<HeaderDrawerAccount />)
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

  test('the header’s Sign in comes back to the page it was pressed on, a shared sheet among them (r3 E3)', () => {
    authed = false
    setQueryAnswers({})
    const before = window.location.href
    window.location.href = 'http://localhost/build/p/mech/tow-rig-abc123?from=link'
    try {
      wrap(<HeaderActions />)
      fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }))
      expect(signIn.mock.calls.at(-1)).toEqual(['/p/mech/tow-rig-abc123?from=link'])
    } finally {
      window.location.href = before
    }
  })

  test('mobile: the header row stays empty and the drawer offers sign-in', () => {
    authed = false
    setQueryAnswers({})
    const row = wrap(<HeaderMobileActions />)
    expect(row.container.innerHTML).toBe('')
    row.unmount()

    wrap(<HeaderDrawerAccount />)
    expect(screen.getByRole('button', { name: 'Sign in with Discord' })).toBeTruthy()
  })
})
