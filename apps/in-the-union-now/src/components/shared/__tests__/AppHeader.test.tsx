/**
 * Unit tests for AppHeader (brand chrome, report item P-1).
 *
 * Tests that:
 * - Renders the ITUN wordmark with the Beta pill
 * - Brand block links home ("/")
 * - Renders the SU mark image
 * - Renders an outbound SRD link (new tab, safe rel)
 * - Renders the search trigger only when onSearchClick is provided (P-2)
 */

import '@testing-library/jest-dom'
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'

import { AppHeader } from '../AppHeader'

describe('AppHeader', () => {
  test('renders the ITUN wordmark with the Beta pill, linked home', () => {
    render(<AppHeader />)
    const brand = screen.getByRole('link', { name: /ITUN/i }) as HTMLAnchorElement
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.textContent).toContain('ITUN')
    expect(brand.textContent).toContain('Beta')
  })

  test('renders the SU mark', () => {
    render(<AppHeader />)
    const mark = screen.getByRole('img', { name: 'Salvage Union' }) as HTMLImageElement
    expect(mark.getAttribute('src')).toBe('/logos/su-cargo-dark.svg')
  })

  test('links out to the SRD site in a new tab', () => {
    render(<AppHeader />)
    const srdLink = screen.getByRole('link', { name: /SRD/i }) as HTMLAnchorElement
    expect(srdLink.getAttribute('href')).toBe('https://salvageunion.io')
    expect(srdLink.getAttribute('target')).toBe('_blank')
    expect(srdLink.getAttribute('rel')).toBe('noopener noreferrer')
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
})
