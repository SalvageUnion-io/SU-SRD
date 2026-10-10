/**
 * Unit tests for AppHeader — ITUN's preset of the Union bar (brand refresh P2a).
 *
 * Tests that:
 * - The one lockup (the SU mark) links home ("/")
 * - The Reference | Build switcher replaces the old "SRD ↗": Build is the tab
 *   you are on (an inverse stamp, `aria-current`), Reference goes to the SRD in
 *   the same tab
 * - The nav reads Shelves · Games · Starter Set, with the app's Games control
 *   in its place, and marks the page you are on
 * - About and Changelog are at the drawer's foot, not in the bar (issue 1255)
 * - Search is the bar's search slot (issue 1255), with its phone form by the hamburger
 * - Places the app's slots: `actions` at the bar's end, `mobileActions` beside
 *   the hamburger, `drawerExtra` inside the drawer
 */

import '@testing-library/jest-dom'
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { AppHeader } from '../AppHeader'

const SRD = 'https://salvageunion.io'

describe('AppHeader', () => {
  test('the SU mark is the lockup, linked home', () => {
    render(<AppHeader />)
    const mark = screen.getByRole<HTMLImageElement>('img', { name: 'Salvage Union' })
    expect(mark.getAttribute('src')).toBe('/logos/su-cargo-dark.svg')
    expect(mark.closest('a')?.getAttribute('href')).toBe('/')
  })

  test('the switcher: Build is here, Reference crosses to the SRD in the same tab', () => {
    render(<AppHeader />)
    const tools = within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    const build = tools.getByRole('link', { name: 'Build' })
    expect(build.getAttribute('aria-current')).toBe('true')
    expect(build.getAttribute('href')).toBe('/')
    const reference = tools.getByRole('link', { name: 'Reference' })
    expect(reference.getAttribute('aria-current')).toBeNull()
    expect(reference.getAttribute('href')).toBe(SRD)
    expect(reference.getAttribute('target')).toBeNull()
    // No off-site arrows between the two tools (ruleset §3.11).
    expect(screen.queryByRole('link', { name: /SRD ↗/ })).toBeFalsy()
  })

  test('the nav reads Shelves · Games · Starter Set, Games being the app control', () => {
    render(<AppHeader games={<button type="button">Games</button>} />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(
      Array.from(nav.querySelectorAll('a, button')).map((el) => el.textContent?.trim())
    ).toEqual(['Shelves', 'Games', 'Starter Set'])
    expect(within(nav).getByRole('link', { name: 'Starter Set' }).getAttribute('href')).toBe(
      '/starter/'
    )
  })

  test('marks the page you are on', () => {
    render(<AppHeader pathname="/starter/" />)
    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }))
    expect(nav.getByRole('link', { name: 'Starter Set' }).getAttribute('aria-current')).toBe('page')
    expect(nav.getByRole('link', { name: 'Shelves' }).getAttribute('aria-current')).toBeNull()
  })

  test('About and Changelog are not in the bar: they sit at the drawer’s foot', () => {
    render(<AppHeader />)
    const banner = within(screen.getByRole('banner'))
    expect(banner.queryByRole('link', { name: 'About' })).toBeFalsy()
    expect(banner.queryByRole('link', { name: 'Changelog' })).toBeFalsy()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const foot = within(screen.getByRole('navigation', { name: 'More' }))
    expect(foot.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/about')
    expect(foot.getByRole('link', { name: 'Changelog' }).getAttribute('href')).toBe('/changelog')
  })

  test('search is the bar’s slot, and its phone form sits beside the hamburger', () => {
    render(
      <AppHeader
        search={<button type="button">Search the rules</button>}
        mobileSearch={<button type="button">Search (phone)</button>}
      />
    )
    const header = within(screen.getByRole('banner'))
    expect(header.getByRole('button', { name: 'Search the rules' })).toBeTruthy()
    const phone = header.getByRole('button', { name: 'Search (phone)' })
    const hamburger = header.getByRole('button', { name: 'Open menu' })
    expect(phone.compareDocumentPosition(hamburger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('renders a hamburger trigger for the mobile nav drawer, closed by default', () => {
    render(<AppHeader />)
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeFalsy()
  })

  test('opening the hamburger reveals the nav, the site links and Buy the game', () => {
    render(<AppHeader pathname="/" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = within(screen.getByRole('dialog'))
    const shelves = drawer.getByRole('link', { name: 'Shelves' })
    // The page you are on is an ink plate, never the rust primary.
    expect(shelves.getAttribute('aria-current')).toBe('page')
    expect(shelves.className).toContain('su-btn--here')
    expect(shelves.className).not.toContain('su-btn--primary')
    expect(drawer.getByRole('link', { name: 'Starter Set' })).toBeTruthy()
    expect(drawer.getByRole('link', { name: 'About' })).toBeTruthy()
    expect(drawer.getByRole('link', { name: 'Changelog' })).toBeTruthy()
    expect(drawer.getByRole('link', { name: 'Discord' }).getAttribute('href')).toBe(
      `${SRD}/discord/`
    )
    const buy = drawer.getByRole('link', { name: /buy the game/i })
    expect(buy.getAttribute('href')).toBe('https://leyline.press/collections/salvage-union')
    expect(buy.getAttribute('target')).toBe('_blank')
    expect(buy.getAttribute('rel')).toBe('noopener noreferrer')
  })

  // The `/encounter` route this guarded against is deleted, so the assertion can
  // no longer regress by someone re-adding a link to a live screen. Kept because
  // it still pins the intent: GM opposition belongs to the Mediator sheet's NPC
  // tray, and a future Encounter surface should not reappear in the top-level nav.
  test('does not offer Encounter as a nav destination (it lives on the Mediator sheet)', () => {
    render(<AppHeader />)
    expect(screen.queryByRole('link', { name: /encounter/i })).toBeFalsy()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = screen.getByRole('dialog')
    expect(within(drawer).queryByRole('link', { name: /encounter/i })).toBeFalsy()
  })

  test('renders the app actions at the end of the bar, after the nav', () => {
    render(<AppHeader actions={<button type="button">Account menu</button>} />)
    const account = screen.getByRole('button', { name: 'Account menu' })
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(account.closest('nav')).toBeFalsy()
    expect(nav.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('is one row: no product row under a compact bar', () => {
    render(<AppHeader actions={<button type="button">Account menu</button>} />)
    expect(screen.getAllByRole('navigation', { name: 'Main navigation' })).toHaveLength(1)
    expect(screen.getByRole('banner').getAttribute('data-density')).toBe('compact')
  })

  test('puts the mobile actions beside the hamburger, outside the desktop nav', () => {
    render(<AppHeader mobileActions={<button type="button">Account menu</button>} />)
    const account = screen.getByRole('button', { name: 'Account menu' })
    expect(account.closest('nav')).toBeFalsy()
    // Same cluster as the hamburger.
    expect(account.parentElement).toBe(
      screen.getByRole('button', { name: 'Open menu' }).parentElement
    )
  })

  test('renders the drawer extra inside the drawer, and hands it a way to close it', () => {
    render(
      <AppHeader
        drawerExtra={(close) => (
          <button type="button" onClick={close}>
            My Stuff
          </button>
        )}
      />
    )
    expect(screen.queryByRole('button', { name: 'My Stuff' })).toBeFalsy()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = screen.getByRole('dialog')
    fireEvent.click(within(drawer).getByRole('button', { name: 'My Stuff' }))
    expect(screen.queryByRole('dialog')).toBeFalsy()
  })

  test('puts the search in the bar, before the account control', () => {
    render(
      <AppHeader
        search={<button type="button">Search the rules</button>}
        actions={<button type="button">Account menu</button>}
      />
    )
    const search = screen.getByRole('button', { name: 'Search the rules' })
    const account = screen.getByRole('button', { name: 'Account menu' })
    expect(search.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // One bar: there is no floating button anywhere else.
    expect(search.closest('header')).toBe(screen.getByRole('banner'))
  })

  test('puts the phone search beside the hamburger, before the mobile account', () => {
    render(
      <AppHeader
        mobileSearch={<button type="button">Phone search</button>}
        mobileActions={<button type="button">Account menu</button>}
      />
    )
    const search = screen.getByRole('button', { name: 'Phone search' })
    const account = screen.getByRole('button', { name: 'Account menu' })
    expect(search.parentElement).toBe(account.parentElement)
    expect(search.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
