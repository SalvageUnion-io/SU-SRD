/**
 * The SRD's phone menu: the shared NavDrawer fed the build-time chapter index
 * (`NAV_CATALOG`), the live search, and the site's own links, the one for the
 * page you are on marked current from `location.pathname`.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { NAV_CATALOG } from '../../../generated/navCatalog'
import { MobileNavIsland } from '../MobileNavIsland'

afterEach(() => {
  window.location.href = 'http://localhost/'
})

async function openMenu() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  })
  return screen.getByRole('dialog')
}

describe('MobileNavIsland', () => {
  test('opens on your own areas (Build, Play), then the chapter index, every schema a row, no counts', async () => {
    render(<MobileNavIsland />)
    const menu = await openMenu()
    const chapters = within(menu)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
      // The drawer's own (visually hidden) title heads the dialog.
      .filter((label) => label !== 'Navigation menu')
    // Your own things lead, named as the bar's links are; then the book's chapters.
    expect(chapters).toEqual(['Build', 'Play', ...NAV_CATALOG.map((chapter) => chapter.title)])
    const first = NAV_CATALOG[0]?.rows[0]
    if (!first) throw new Error('empty NAV_CATALOG')
    const row = within(menu).getByRole('link', { name: first.label })
    expect(row.getAttribute('href')).toBe(first.href)
    expect(row.textContent).toBe(first.label)
  })

  test('carries the search and the mark home', async () => {
    render(<MobileNavIsland />)
    const menu = await openMenu()
    expect(within(menu).getByRole('combobox', { name: 'Search the Reference' })).toBeTruthy()
    expect(within(menu).getByRole('link', { name: 'Salvage Union' }).getAttribute('href')).toBe('/')
  })

  test('marks the link for the page you are on as current; the store opens in a new tab', async () => {
    window.location.href = 'http://localhost/changelog/'
    render(<MobileNavIsland />)
    const menu = await openMenu()
    expect(within(menu).getByRole('link', { name: 'Changelog' }).getAttribute('aria-current')).toBe(
      'page'
    )
    expect(within(menu).getByRole('link', { name: 'About' }).hasAttribute('aria-current')).toBe(
      false
    )
    const store = within(menu).getByRole('link', { name: 'Buy the game' })
    expect(store.getAttribute('target')).toBe('_blank')
    expect(store.getAttribute('href')).toBe('https://leyline.press/collections/salvage-union')
  })
})
