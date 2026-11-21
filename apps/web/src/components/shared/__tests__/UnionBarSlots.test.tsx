/**
 * The app's live half of the Union bar: the shell's bar (`shell/unionBar.ts`)
 * with its slots filled.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { inAppRoute, unionHere, useBarMode } from '../../../lib/barLinks'
import { pageOrigin } from '../../../lib/site'
import { renderUnionBar } from '../../../shell/unionBar'
import { hidesUnionBar, slotSelector } from '../../../shell/unionSlots'
import { UnionBarSlots } from '../UnionBarSlots'

/** The SRD: the page's own origin, or production's where the test has none. */
const SRD = pageOrigin()

beforeEach(() => {
  document.body.innerHTML = renderUnionBar()
})

// The bar is this file's own markup, outside any container the preload's
// cleanup removes: leave the body as the next file expects it.
afterEach(() => {
  document.body.innerHTML = ''
})

const button = (name: string) => (
  <button type="button" key={name}>
    {name}
  </button>
)

describe('UnionBarSlots', () => {
  test('fills the bar’s end and the phone cluster; the bar’s navs are its area links and rails', () => {
    render(
      <UnionBarSlots
        pathname="/games/"
        search={button('Search')}
        actions={button('Account')}
        mobileSearch={button('Phone search')}
        mobileActions={button('Avatar')}
      />
    )
    const navs = screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'))
    expect(navs[0]).toBe('Salvage Union tools')
    for (const label of navs.slice(1)) expect(label).toMatch(/^In /)
    const header = within(screen.getByRole('banner'))
    const search = header.getByRole('button', { name: 'Search' })
    const account = header.getByRole('button', { name: 'Account' })
    expect(search.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const mobile = document.querySelector(slotSelector('mobile'))
    expect(
      Array.from(mobile?.querySelectorAll('button') ?? []).map(
        (b) => b.textContent || b.getAttribute('aria-label')
      )
    ).toEqual(['Phone search', 'Avatar', 'Open menu'])
  })

  test('marks the tab you are under: Play on Your Games and every Game route, Build everywhere else', () => {
    const tools = () => within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    const current = () =>
      tools()
        .getAllByRole('link')
        .filter((tab) => tab.getAttribute('aria-current') === 'true')
        .map((tab) => tab.textContent)
    const { rerender } = render(<UnionBarSlots pathname="/games/" />)
    expect(
      tools()
        .getAllByRole('link')
        .map((tab) => tab.textContent)
    ).toEqual(['Reference', 'Build', 'Play', 'Buy the game (opens in a new tab)'])
    expect(current()).toEqual(['Play'])
    rerender(<UnionBarSlots pathname="/starter/" />)
    expect(current()).toEqual(['Build'])
    rerender(<UnionBarSlots pathname="/pilots/p1/play" />)
    expect(current()).toEqual(['Build'])
    rerender(<UnionBarSlots pathname="/games/g1" />)
    expect(current()).toEqual(['Play'])
  })

  test('a page that says its own tab holds it while it is on screen: a pilot in a Game is under Play', () => {
    const tools = () => within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    const current = () =>
      tools()
        .getAllByRole('link')
        .filter((tab) => tab.getAttribute('aria-current') === 'true')
        .map((tab) => tab.textContent)
    const InGame = ({ inGame }: { inGame: boolean }) => {
      useBarMode(inGame ? 'play' : null)
      return null
    }
    const page = (inGame: boolean | null) => (
      <>
        <UnionBarSlots pathname="/pilots/p1" />
        {inGame === null ? null : <InGame inGame={inGame} />}
      </>
    )
    const { rerender } = render(page(true))
    expect(current()).toEqual(['Play'])
    rerender(page(false))
    expect(current()).toEqual(['Build'])
    rerender(page(true))
    rerender(page(null))
    expect(current()).toEqual(['Build'])
  })

  test('the bar wears its tab’s colour as you route', () => {
    const mode = () => document.querySelector('.su-union-bar')?.getAttribute('data-mode')
    expect(mode()).toBe('build')
    const { rerender } = render(<UnionBarSlots pathname="/games/" />)
    expect(mode()).toBe('play')
    rerender(<UnionBarSlots pathname="/" />)
    expect(mode()).toBe('build')
  })

  test('fills nothing while the route draws no bar', () => {
    render(<UnionBarSlots pathname="/play/x" barHidden search={button('Search')} />)
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })

  /** The drawer's nav links, by name, once opened. */
  const drawerLinks = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = within(screen.getByRole('dialog'))
    return {
      drawer,
      names: drawer
        .getAllByRole('link')
        .filter((link) => link.className.includes('su-nav-drawer__link'))
        .map((link) => link.textContent),
    }
  }

  test('the drawer: the reference pages’ own, and the app’s extra', () => {
    render(
      <UnionBarSlots
        pathname="/"
        drawerExtra={(close) => (
          <button type="button" onClick={close}>
            Sign in
          </button>
        )}
      />
    )
    const { drawer, names } = drawerLinks()
    expect(drawer.getByRole('link', { name: 'Salvage Union' }).getAttribute('href')).toBe('/')
    expect(names).toEqual(['About', 'Changelog', 'Discord', 'API', 'Buy the game'])
    expect(drawer.getByRole('link', { name: 'Discord' }).getAttribute('href')).toBe('/bot/')
    expect(drawer.getByRole('link', { name: /buy the game/i }).getAttribute('target')).toBe(
      '_blank'
    )
    // The book's chapter index, as on a reference page.
    expect(drawer.getByRole('heading', { name: /^Mech Workshop/ })).toBeTruthy()
    fireEvent.click(drawer.getByRole('button', { name: 'Sign in' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('the bar’s rules', () => {
  test('a Play screen and the link-preview surface draw no bar', () => {
    expect(hidesUnionBar('/pilots/abc/play')).toBe(true)
    expect(hidesUnionBar('/games/g1/mediate')).toBe(true)
    expect(hidesUnionBar('/og/pilot/abc')).toBe(true)
    expect(hidesUnionBar('/pilots/abc')).toBe(false)
  })

  test('Your Games keeps the bar: its Games tab is how you got there', () => {
    expect(hidesUnionBar('/games/')).toBe(false)
    expect(hidesUnionBar('/play')).toBe(false)
  })

  test('which tab a route is under: the Games for /games and below, the Training Bay for the rest', () => {
    expect(unionHere('/')).toBe('build')
    expect(unionHere('/patterns/')).toBe('build')
    expect(unionHere('/starter/pilot/x')).toBe('build')
    expect(unionHere('/settings')).toBe('build')
    // A pilot's Play mode is the pilot's own page (and draws no bar, ADR-066).
    expect(unionHere('/pilots/p1/play')).toBe('build')
    expect(unionHere('/games')).toBe('play')
    expect(unionHere('/games/')).toBe('play')
    expect(unionHere('/games/g1/mediate')).toBe('play')
    expect(unionHere('/games/invite/abc')).toBe('play')
    expect(unionHere('/gamesroom')).toBe('build')
    // The Mediator's Kit's sheets are Play's, where the Kit lists them (MD-02).
    expect(unionHere('/npcs/n1')).toBe('play')
    expect(unionHere('/npcs/new')).toBe('play')
    expect(unionHere('/encounters/e1')).toBe('play')
    expect(unionHere('/games/g1/prep')).toBe('play')
  })

  test('a Game’s page keeps the bar: it is a Manage page, not a Cockpit', () => {
    expect(hidesUnionBar('/games/g1')).toBe(false)
    expect(unionHere('/games/g1')).toBe('play')
    // The Mediator's Cockpit for the same Game still draws its own bar.
    expect(hidesUnionBar('/games/g1/mediate')).toBe(true)
  })

  test('routes a plain click on a link under the base in place, and nothing else', () => {
    document.body.innerHTML = `
      <a id="in" href="/build/starter/?a=1#b">in</a>
      <a id="home" href="/build">home</a>
      <a id="srd" href="/chassis/">srd</a>
      <a id="tab" href="/build/" target="_blank">tab</a>
      <a id="off" href="https://example.com/build/">off</a>`
    const click = (id: string, init: MouseEventInit = {}) => {
      const event = new MouseEvent('click', { bubbles: true, button: 0, ...init })
      Object.defineProperty(event, 'target', { value: document.getElementById(id) })
      return inAppRoute(event, SRD)
    }
    expect(click('in')).toBe('/starter/?a=1#b')
    expect(click('home')).toBe('/')
    expect(click('in', { metaKey: true })).toBeNull()
    expect(click('in', { button: 1 })).toBeNull()
    expect(click('srd')).toBeNull()
    expect(click('tab')).toBeNull()
    expect(click('off')).toBeNull()
  })
})
