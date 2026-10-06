import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'

/**
 * The masthead's Games menu (desktop) and its drawer list (mobile).
 *
 * What these pin: "My Stuff" heads the list, every Game follows with the
 * player's role in it, and picking a row does the two things the menu exists
 * for — it makes that container active AND takes the player to the Roster at
 * `/`, which shows it. Nothing here links to `/games`. Outside Connected there
 * is no menu at all.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

let authed = true

const convexMocks = await installConvexMocks({
  router: true,
  convexReact: { useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }) },
})

const { GamesDrawerList, GamesMenu } = await import('../GamesMenu')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { SHELF } = await import('../../../lib/container')
const { setActiveContainer, getActiveContainer } = await import(
  '../../../stores/activeContainerStore'
)
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
  setActiveContainer(SHELF)
  convexMocks.navigations.length = 0
  // Process-global: a leaked signed-in state changes what later files exercise.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

afterAll(convexMocks.restore)

describe('GamesMenu', () => {
  test('is a menu button listing My Stuff, then each Game with its role', async () => {
    setQueryAnswers({ 'games:listMine': GAMES })
    wrap(<GamesMenu />)

    expect(screen.getByRole('button', { name: 'Games' }).getAttribute('aria-haspopup')).toBe('menu')
    const items = within(await openGames()).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'My Stuff',
      'Union Crawler #430, Mediator',
      'The Long Haul, Player',
    ])
    // A rule divides the Shelf from the Games.
    expect(screen.getAllByRole('separator')).toHaveLength(1)
  })

  test('picking a Game makes it the active container and goes to the Roster', async () => {
    setQueryAnswers({ 'games:listMine': GAMES })
    wrap(<GamesMenu />)

    const menu = await openGames()
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: /The Long Haul/ }))
    })
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g2' })
    expect(convexMocks.navigations).toEqual([{ to: '/' }])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  test('picking My Stuff makes the Shelf the active container', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g1' })
    setQueryAnswers({ 'games:listMine': GAMES })
    wrap(<GamesMenu />)

    const menu = await openGames()
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'My Stuff' }))
    })
    expect(getActiveContainer()).toEqual(SHELF)
    expect(convexMocks.navigations).toEqual([{ to: '/' }])
  })

  test('with no Games it says so, as an inert row', async () => {
    setQueryAnswers({ 'games:listMine': [] })
    wrap(<GamesMenu />)

    const empty = within(await openGames()).getByRole('menuitem', { name: 'No games yet' })
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
  test('picking a row sets the container, goes to the Roster and closes the drawer', () => {
    setQueryAnswers({ 'games:listMine': GAMES })
    let closed = 0
    wrap(<GamesDrawerList onPick={() => closed++} />)

    const list = screen.getByRole('navigation', { name: 'Games' })
    fireEvent.click(within(list).getByRole('button', { name: 'Union Crawler #430 · Mediator' }))
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g1' })
    expect(convexMocks.navigations).toEqual([{ to: '/' }])
    expect(closed).toBe(1)
  })

  test('with no Games it still offers My Stuff, and says there are none', () => {
    setQueryAnswers({ 'games:listMine': [] })
    wrap(<GamesDrawerList onPick={() => {}} />)

    expect(screen.getByRole('button', { name: 'My Stuff' })).toBeTruthy()
    expect(screen.getByText('No games yet')).toBeTruthy()
  })
})
