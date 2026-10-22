import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'

/**
 * The masthead's Games menu (desktop) and its drawer list (mobile).
 *
 * What these pin: the list is every Game with the player's role in it, and
 * no Training Bay row, and picking a row opens that Game's page in Play
 * (`/play/games/$gameId`, ADR-052 §5). Outside Connected there is no menu at
 * all.
 */

import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'

let authed = true

const convexMocks = await installConvexMocks({
  router: true,
  convexReact: { useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }) },
})

const { GamesDrawerList, GamesMenu } = await import('../GamesMenu')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')

const GAMES = [
  { _id: 'g1', name: 'Union Crawler #430', mediator: true, organizer: true },
  { _id: 'g2', name: 'The Long Haul', mediator: false, organizer: false },
]

const wrap = (ui: ReactNode) => render(<ConnectionProvider>{ui}</ConnectionProvider>)

async function openGames(): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Games' }))
  })
  return screen.getByRole('menu')
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  authed = true
  setOnline(true)
  convexMocks.navigations.length = 0
  // Process-global: a leaked signed-in state changes what later files exercise.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

afterAll(convexMocks.restore)

describe('GamesMenu', () => {
  test('is a menu button listing each Game with its role, and no Training Bay', async () => {
    setQueryAnswers({ 'games:listMine': GAMES })
    wrap(<GamesMenu />)

    expect(screen.getByRole('button', { name: 'Games' }).getAttribute('aria-haspopup')).toBe('menu')
    const items = within(await openGames()).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Union Crawler #430, Mediator',
      'The Long Haul, Player',
    ])
    expect(screen.queryAllByRole('separator')).toHaveLength(0)
  })

  test('picking a Game opens its page in Play', async () => {
    setQueryAnswers({ 'games:listMine': GAMES })
    wrap(<GamesMenu />)

    const menu = await openGames()
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: /The Long Haul/ }))
    })
    expect(convexMocks.navigations).toEqual([{ to: '/play/games/g2' }])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  test('with no Games it says so, as an inert row', async () => {
    setQueryAnswers({ 'games:listMine': [] })
    wrap(<GamesMenu />)

    const empty = within(await openGames()).getByRole('menuitem', { name: 'No Games yet.' })
    expect(empty.getAttribute('aria-disabled')).toBe('true')
    await act(async () => {
      fireEvent.click(empty)
    })
    expect(convexMocks.navigations).toEqual([])
  })

  test('renders nothing signed out, or signed in but offline', () => {
    setQueryAnswers({ 'games:listMine': GAMES })
    authed = false
    const signedOut = wrap(<GamesMenu />)
    expect(signedOut.container.innerHTML).toBe('')
    signedOut.unmount()

    authed = true
    setOnline(false)
    const offline = wrap(<GamesMenu />)
    expect(offline.container.innerHTML).toBe('')
  })
})

describe('GamesDrawerList', () => {
  test('picking a row opens that Game’s page in Play and closes the drawer', () => {
    setQueryAnswers({ 'games:listMine': GAMES })
    let closed = 0
    wrap(<GamesDrawerList onPick={() => closed++} />)

    const list = screen.getByRole('navigation', { name: 'Games' })
    // Each Game is its Compact (ruleset §1.9), its role a chip on it.
    const game = within(list).getByRole('button', { name: 'Union Crawler #430' })
    expect(within(list).getByText('Mediator')).toBeTruthy()
    fireEvent.click(game)
    expect(convexMocks.navigations).toEqual([{ to: '/play/games/g1' }])
    expect(closed).toBe(1)
  })

  test('with no Games it says there are none, and offers no Training Bay row', () => {
    setQueryAnswers({ 'games:listMine': [] })
    wrap(<GamesDrawerList onPick={() => {}} />)

    expect(screen.queryByRole('button', { name: 'Training Bay' })).toBeNull()
    expect(screen.getByText('No Games yet.')).toBeTruthy()
  })
})
