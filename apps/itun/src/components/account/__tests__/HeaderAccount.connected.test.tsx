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
 *   `/settings`) and Sign out, and nothing else. The Games menu sits beside it.
 * - **Signed in, offline** — the identity stays and Sign out still works, but
 *   there is no Games menu: a Disconnected player cannot list their Games.
 * - **Signed out** — "Sign in with Discord" takes the slot, on desktop and in
 *   the mobile drawer; the mobile header row stays empty.
 */

import type { QueryAnswers } from '../../__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

let authed = true
const signIn = mock(async (_provider: string) => undefined)
const signOut = mock(async () => undefined)

// Module scope, before the imports below — see `convexMock.ts`. The auth
// module is mocked through `also` rather than `authReact` so the two actions
// are spies this file can read.
const convexMocks = await installConvexMocks({
  router: true,
  convexReact: { useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }) },
  also: {
    '@convex-dev/auth/react': () => ({
      useAuthActions: () => ({ signIn, signOut }),
      ConvexAuthProvider: ({ children }: { children: ReactNode }) => children,
    }),
  },
})

const { HeaderActions, HeaderDrawerAccount, HeaderMobileActions } = await import('../HeaderAccount')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')

const ME = { _id: 'u1', displayName: 'Beefcake', avatarUrl: null, email: null }
const GAMES = [{ _id: 'g1', name: 'Union Crawler #430', mediator: true, organizer: true }]

const QUERIES: QueryAnswers = { 'account:me': ME, 'games:listMine': GAMES }

/** Force the browser's online flag, which is what picks Connected vs Disconnected. */
function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

const wrap = (ui: ReactNode) => render(<ConnectionProvider>{ui}</ConnectionProvider>)

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
  convexMocks.navigations.length = 0
  // Process-global: a leaked signed-in state changes what later files exercise.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

afterAll(convexMocks.restore)

describe('signed in and connected', () => {
  test('the trigger is a menu button showing the display name and avatar initial', () => {
    setQueryAnswers(QUERIES)
    wrap(<HeaderActions />)

    const trigger = screen.getByRole('button', { name: 'Account menu for Beefcake' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.textContent).toContain('Beefcake')
    // No avatar URL: the circle falls back to the initial.
    expect(trigger.textContent).toContain('B')
  })

  test('its menu holds Settings and Sign out, and nothing else', async () => {
    setQueryAnswers(QUERIES)
    wrap(<HeaderActions />)

    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Settings', 'Sign out'])
  })

  test('Settings goes to /settings', async () => {
    setQueryAnswers(QUERIES)
    wrap(<HeaderActions />)

    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Settings' }))
    })
    expect(convexMocks.navigations).toEqual([{ to: '/settings' }])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  test('Sign out signs out', async () => {
    setQueryAnswers(QUERIES)
    wrap(<HeaderActions />)

    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    })
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  test('the Games menu sits beside it, before the account', () => {
    setQueryAnswers(QUERIES)
    wrap(<HeaderActions />)

    const games = screen.getByRole('button', { name: 'Games' })
    const account = screen.getByRole('button', { name: 'Account menu for Beefcake' })
    expect(games.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The old sub-header's plain buttons are gone from this slot.
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Account' })).toBeNull()
  })

  test('mobile: the header row shows the avatar alone, still naming the account', () => {
    setQueryAnswers(QUERIES)
    wrap(<HeaderMobileActions />)

    const trigger = screen.getByRole('button', { name: 'Account menu for Beefcake' })
    expect(trigger.textContent).not.toContain('Beefcake')
  })

  test('mobile: the drawer lists the Games rather than offering sign-in', () => {
    setQueryAnswers(QUERIES)
    wrap(<HeaderDrawerAccount close={() => {}} />)

    expect(screen.getByRole('navigation', { name: 'Games' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
  })

  test('before the profile arrives it reads "Account" rather than guessing a name', () => {
    setQueryAnswers({ ...QUERIES, 'account:me': undefined })
    wrap(<HeaderActions />)

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger.textContent).toContain('Account')
  })
})

describe('signed in but offline', () => {
  test('keeps the identity and a working Sign out, with no Games menu', async () => {
    setOnline(false)
    setQueryAnswers(QUERIES)
    wrap(<HeaderActions />)

    expect(screen.queryByRole('button', { name: 'Games' })).toBeNull()
    const menu = await openMenu(screen.getByRole('button', { name: 'Account menu for Beefcake' }))
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    })
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  test('the drawer has nothing to add', () => {
    setOnline(false)
    setQueryAnswers(QUERIES)
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
    expect(signIn).toHaveBeenCalledWith('discord')
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
