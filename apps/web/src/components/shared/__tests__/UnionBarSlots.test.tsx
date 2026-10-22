/**
 * The app's live half of the Union bar: the shell's bar (`shell/unionBar.ts`)
 * with its slots filled.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { inAppRoute, isCurrent, unionHere } from '../../../lib/barLinks'
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

/** A mode's nav: its links and controls, by name. */
const navOf = (mode: 'Build' | 'Play') => screen.getByRole('navigation', { name: mode })
const entries = (nav: HTMLElement) =>
  Array.from(nav.querySelectorAll('a, button')).map((el) => el.textContent)

/** The current nav link in a mode's nav, if any. */
const currentIn = (mode: 'Build' | 'Play') =>
  Array.from(navOf(mode).querySelectorAll('[aria-current="page"]')).map((el) => el.textContent)

describe('UnionBarSlots', () => {
  test('fills Play’s nav with the Games control, the bar’s end and the phone cluster', () => {
    render(
      <UnionBarSlots
        pathname="/play/"
        games={button('Games')}
        search={button('Search')}
        actions={button('Account')}
        mobileSearch={button('Phone search')}
        mobileActions={button('Avatar')}
      />
    )
    expect(entries(navOf('Build'))).toEqual(['Training Bay', 'Patterns', 'Starter Set'])
    expect(entries(navOf('Play'))).toEqual(['Games', 'Solo'])
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

  test('marks the page you are on in Build’s nav, as you route', () => {
    const { rerender } = render(<UnionBarSlots pathname="/starter/" />)
    expect(currentIn('Build')).toEqual(['Starter Set'])
    rerender(<UnionBarSlots pathname="/" />)
    expect(currentIn('Build')).toEqual(['Training Bay'])
    rerender(<UnionBarSlots pathname="/mechs/patterns/" />)
    expect(currentIn('Build')).toEqual(['Patterns'])
    rerender(<UnionBarSlots pathname="/pilots/new" />)
    expect(currentIn('Build')).toEqual([])
    // Solo is an anchor on the hub, never a page: on Play's routes no link is current.
    rerender(<UnionBarSlots pathname="/play/" />)
    expect(currentIn('Build')).toEqual([])
    expect(currentIn('Play')).toEqual([])
  })

  test('marks the mode you are in: Play on the hub and every Game route, Build everywhere else', () => {
    const tools = () => within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    const current = () =>
      tools()
        .getAllByRole('link')
        .filter((tab) => tab.getAttribute('aria-current') === 'true')
        .map((tab) => tab.textContent)
    const { rerender } = render(<UnionBarSlots pathname="/play/" />)
    expect(current()).toEqual(['Play'])
    rerender(<UnionBarSlots pathname="/starter/" />)
    expect(current()).toEqual(['Build'])
    rerender(<UnionBarSlots pathname="/play/games/g1" />)
    expect(current()).toEqual(['Play'])
  })

  test('the bar wears the mode, which shows its nav: Play’s on Play’s routes, Build’s everywhere else', () => {
    const mode = () => document.querySelector('.su-union-bar')?.getAttribute('data-mode')
    expect(mode()).toBe('build')
    const { rerender } = render(<UnionBarSlots pathname="/play/" />)
    expect(mode()).toBe('play')
    rerender(<UnionBarSlots pathname="/" />)
    expect(mode()).toBe('build')
  })

  test('fills only the banner while the route draws no bar', () => {
    render(
      <UnionBarSlots
        pathname="/play/x"
        barHidden
        banner={button('Offline')}
        search={button('Search')}
      />
    )
    expect(document.querySelector(slotSelector('banner'))?.textContent).toBe('Offline')
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

  test('the drawer: the reference pages’ own, Build’s nav first, and the app’s extra', () => {
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
    expect(drawer.getByRole('link', { name: 'Salvage Union SRD' }).getAttribute('href')).toBe('/')
    const hangar = drawer.getByRole('link', { name: 'Training Bay' })
    // The page you are on is an ink plate, never the rust primary.
    expect(hangar.getAttribute('aria-current')).toBe('page')
    expect(hangar.className).toContain('su-btn--here')
    expect(names).toEqual([
      'Training Bay',
      'Patterns',
      'Starter Set',
      'About',
      'Changelog',
      'Discord',
      'API',
      'Buy the game',
    ])
    expect(drawer.getByRole('link', { name: 'Discord' }).getAttribute('href')).toBe('/bot/')
    expect(drawer.getByRole('link', { name: /buy the game/i }).getAttribute('target')).toBe(
      '_blank'
    )
    // The book's chapter index, as on a reference page.
    expect(drawer.getByRole('heading', { name: 'Mech Workshop' })).toBeTruthy()
    fireEvent.click(drawer.getByRole('button', { name: 'Sign in' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('the drawer in Play: Play’s nav, Solo an anchor on the hub', () => {
    render(<UnionBarSlots pathname="/play/" />)
    const { drawer, names } = drawerLinks()
    expect(names).toEqual(['Solo', 'About', 'Changelog', 'Discord', 'API', 'Buy the game'])
    // No router here, so the link shows its route.
    expect(drawer.getByRole('link', { name: 'Solo' }).getAttribute('href')).toEndWith(
      '/play/#play-solo'
    )
    fireEvent.click(drawer.getByRole('button', { name: 'Close menu' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('the bar’s rules', () => {
  test('a Play screen and the link-preview surface draw no bar', () => {
    expect(hidesUnionBar('/play/abc')).toBe(true)
    expect(hidesUnionBar('/play/game/g1')).toBe(true)
    expect(hidesUnionBar('/og/pilot/abc')).toBe(true)
    expect(hidesUnionBar('/sheet/pilot/abc')).toBe(false)
  })

  test('the Play landing keeps the bar: its Play tab is how you got there', () => {
    expect(hidesUnionBar('/play/')).toBe(false)
    expect(hidesUnionBar('/play')).toBe(false)
  })

  test('where a route is: Build’s nav item, or Play with Games ▾ on the hub and any Game route', () => {
    expect(unionHere('/')).toEqual({ mode: 'build', nav: 'hangar' })
    expect(unionHere('/mechs/patterns/')).toEqual({ mode: 'build', nav: 'patterns' })
    expect(unionHere('/mechs/new')).toEqual({ mode: 'build', nav: null })
    expect(unionHere('/starter/pilot/x')).toEqual({ mode: 'build', nav: 'starter' })
    expect(unionHere('/settings')).toEqual({ mode: 'build', nav: null })
    expect(unionHere('/players')).toEqual({ mode: 'build', nav: null })
    expect(unionHere('/play')).toEqual({ mode: 'play', nav: 'games' })
    expect(unionHere('/play/')).toEqual({ mode: 'play', nav: 'games' })
    expect(unionHere('/play/games/g1')).toEqual({ mode: 'play', nav: 'games' })
    expect(unionHere('/play/game/g1')).toEqual({ mode: 'play', nav: 'games' })
    // A solo Cockpit is Play's, under no nav item (and draws no bar).
    expect(unionHere('/play/p1')).toEqual({ mode: 'play', nav: null })
    // An invite joins a Game: Play's, under no nav item (ADR-052 §4).
    expect(unionHere('/invite/abc')).toEqual({ mode: 'play', nav: null })
  })

  test('a Game’s page keeps the bar, in Play: it is a Manage page, not a Cockpit', () => {
    expect(hidesUnionBar('/play/games/g1')).toBe(false)
    expect(unionHere('/play/games/g1').mode).toBe('play')
    // The Mediator's Cockpit for the same Game still draws its own bar.
    expect(hidesUnionBar('/play/game/g1')).toBe(true)
  })

  test('Training Bay is here only at the root; Starter Set on every page under it', () => {
    expect(isCurrent('/', '/')).toBe(true)
    expect(isCurrent('/', '/starter/')).toBe(false)
    expect(isCurrent('/starter/', '/starter/pilot/x')).toBe(true)
    // The router drops the trailing slash.
    expect(isCurrent('/starter/', '/starter')).toBe(true)
    expect(isCurrent('/starter/', '/starters')).toBe(false)
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
