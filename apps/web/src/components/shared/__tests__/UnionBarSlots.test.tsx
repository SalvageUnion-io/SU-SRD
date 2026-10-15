/**
 * The Cantina's live half of the Union bar: the shell's bar (`shell/unionBar.ts`)
 * with its slots filled.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { inAppRoute, isCurrent } from '../../../lib/barLinks'
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
  test('fills the nav, the bar’s end and the phone cluster, in the bar', () => {
    render(
      <UnionBarSlots
        pathname="/"
        games={button('Games')}
        search={button('Search')}
        actions={button('Account')}
        mobileSearch={button('Phone search')}
        mobileActions={button('Avatar')}
      />
    )
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(Array.from(nav.querySelectorAll('a, button')).map((el) => el.textContent)).toEqual([
      'Hangar',
      'Games',
      'Starter Set',
    ])
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

  test('marks the page you are on in the shell’s nav', () => {
    const { rerender } = render(<UnionBarSlots pathname="/starter/" />)
    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }))
    expect(nav.getByRole('link', { name: 'Starter Set' }).getAttribute('aria-current')).toBe('page')
    expect(nav.getByRole('link', { name: 'Hangar' }).getAttribute('aria-current')).toBeNull()
    rerender(<UnionBarSlots pathname="/" />)
    expect(nav.getByRole('link', { name: 'Hangar' }).getAttribute('aria-current')).toBe('page')
    expect(nav.getByRole('link', { name: 'Starter Set' }).getAttribute('aria-current')).toBeNull()
  })

  test('fills only the banner while the route draws no bar', () => {
    render(
      <UnionBarSlots
        pathname="/dashboard/x"
        barHidden
        banner={button('Offline')}
        search={button('Search')}
      />
    )
    expect(document.querySelector(slotSelector('banner'))?.textContent).toBe('Offline')
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })

  test('the drawer: the reference pages’ own, the Cantina’s nav first, and the app’s extra', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = within(screen.getByRole('dialog'))
    expect(drawer.getByRole('link', { name: 'Salvage Union SRD' }).getAttribute('href')).toBe('/')
    const hangar = drawer.getByRole('link', { name: 'Hangar' })
    // The page you are on is an ink plate, never the rust primary.
    expect(hangar.getAttribute('aria-current')).toBe('page')
    expect(hangar.className).toContain('su-btn--here')
    expect(
      drawer
        .getAllByRole('link')
        .filter((link) => link.className.includes('su-nav-drawer__link'))
        .map((link) => link.textContent)
    ).toEqual(['Hangar', 'Starter Set', 'About', 'Changelog', 'Discord', 'API', 'Buy the game'])
    expect(drawer.getByRole('link', { name: 'Discord' }).getAttribute('href')).toBe('/discord/')
    expect(drawer.getByRole('link', { name: /buy the game/i }).getAttribute('target')).toBe(
      '_blank'
    )
    // The book's chapter index, as on a reference page.
    expect(drawer.getByRole('heading', { name: 'Mech Workshop' })).toBeTruthy()
    fireEvent.click(drawer.getByRole('button', { name: 'Sign in' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('the bar’s rules', () => {
  test('the Dashboard and the link-preview surface draw no bar', () => {
    expect(hidesUnionBar('/dashboard/abc')).toBe(true)
    expect(hidesUnionBar('/og/pilot/abc')).toBe(true)
    expect(hidesUnionBar('/sheet/pilot/abc')).toBe(false)
  })

  test('Hangar is here only at the root; Starter Set on every page under it', () => {
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
