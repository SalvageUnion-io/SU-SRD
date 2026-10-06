/**
 * Unit tests for AppHeader (brand chrome, report item P-1).
 *
 * Tests that:
 * - Renders the "IN THE UNION NOW" wordmark with the Beta pill
 * - Brand block links home ("/")
 * - Renders the SU mark image
 * - Renders an outbound SRD link (new tab, safe rel)
 * - Renders the outbound "Buy the game" link (new tab, safe rel)
 * - Renders the search trigger only when onSearchClick is provided (P-2)
 * - Places the app's slots: `actions` after "Buy the game" in the nav,
 *   `mobileActions` beside the hamburger, `drawerExtra` inside the drawer —
 *   and no second (sub-header) row
 */

import '@testing-library/jest-dom'
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { AppHeader } from 'component-lib'

describe('AppHeader', () => {
  test('renders the "IN THE UNION NOW" wordmark with the Beta pill, linked home', () => {
    render(<AppHeader />)
    const brand = screen.getByRole<HTMLAnchorElement>('link', { name: /IN THE UNION NOW/i })
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.textContent).toContain('IN THE UNION NOW')
    expect(brand.textContent).toContain('Beta')
    expect(brand.textContent).toContain('A Salvage Union Character Manager')
  })

  test('renders the SU mark', () => {
    render(<AppHeader />)
    const mark = screen.getByRole<HTMLImageElement>('img', { name: 'Salvage Union' })
    expect(mark.getAttribute('src')).toBe('/logos/su-cargo-dark.svg')
  })

  test('links out to the SRD site in a new tab', () => {
    render(<AppHeader />)
    const srdLink = screen.getByRole<HTMLAnchorElement>('link', { name: /SRD/i })
    expect(srdLink.getAttribute('href')).toBe('https://salvageunion.io')
    expect(srdLink.getAttribute('target')).toBe('_blank')
    expect(srdLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('links out to the SRD Discord page in a new tab', () => {
    render(<AppHeader />)
    const discordLink = screen.getByRole<HTMLAnchorElement>('link', { name: /discord/i })
    expect(discordLink.getAttribute('href')).toBe('https://salvageunion.io/discord/')
    expect(discordLink.getAttribute('target')).toBe('_blank')
    expect(discordLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('links out to buy the game in a new tab', () => {
    render(<AppHeader />)
    const buyLink = screen.getByRole<HTMLAnchorElement>('link', { name: /buy the game/i })
    expect(buyLink.getAttribute('href')).toBe('https://leyline.press/collections/salvage-union')
    expect(buyLink.getAttribute('target')).toBe('_blank')
    expect(buyLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('renders the search trigger when onSearchClick is provided and fires it', () => {
    const onSearchClick = mock(() => {})
    render(<AppHeader onSearchClick={onSearchClick} />)
    const trigger = screen.getByRole('button', { name: 'Search the SRD' })
    fireEvent.click(trigger)
    expect(onSearchClick).toHaveBeenCalledTimes(1)
  })

  test('omits the search trigger when onSearchClick is not provided', () => {
    render(<AppHeader />)
    expect(screen.queryByRole('button', { name: 'Search the SRD' })).toBeFalsy()
  })

  test('renders a hamburger trigger for the mobile nav drawer, closed by default', () => {
    render(<AppHeader />)
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeFalsy()
  })

  test('opening the hamburger reveals the collapsed nav links in the drawer', () => {
    render(<AppHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = screen.getByRole('dialog')
    expect(within(drawer).getByRole('link', { name: /about/i })).toBeTruthy()
    expect(within(drawer).getByRole('link', { name: /changelog/i })).toBeTruthy()
    expect(within(drawer).getByRole('link', { name: /SRD/i })).toBeTruthy()
    const drawerDiscord = within(drawer).getByRole<HTMLAnchorElement>('link', {
      name: /discord/i,
    })
    expect(drawerDiscord.getAttribute('href')).toBe('https://salvageunion.io/discord/')
    const buy = within(drawer).getByRole<HTMLAnchorElement>('link', {
      name: /buy the game/i,
    })
    expect(buy.getAttribute('href')).toBe('https://leyline.press/collections/salvage-union')
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

  test('renders the app actions in the nav, after "Buy the game"', () => {
    render(<AppHeader actions={<button type="button">Games</button>} />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const games = within(nav).getByRole('button', { name: 'Games' })
    const buy = within(nav).getByRole('link', { name: /buy the game/i })
    // To the right of Buy: later in the nav's document order.
    expect(buy.compareDocumentPosition(games) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('has no sub-header: the masthead is the brand row and nothing else', () => {
    render(<AppHeader actions={<button type="button">Games</button>} />)
    const header = screen.getByRole('banner')
    expect(header.children).toHaveLength(1)
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
            My stuff
          </button>
        )}
      />
    )
    expect(screen.queryByRole('button', { name: 'My stuff' })).toBeFalsy()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = screen.getByRole('dialog')
    fireEvent.click(within(drawer).getByRole('button', { name: 'My stuff' }))
    expect(screen.queryByRole('dialog')).toBeFalsy()
  })
})
