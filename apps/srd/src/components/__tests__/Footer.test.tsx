import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { Footer } from '../Footer'

describe('Footer', () => {
  test('renders Leyline Press copyright', () => {
    render(<Footer poweredBySalvageUrl="/test-logo.webp" />)
    expect(screen.getByText(/Salvage Union is copyrighted by/)).toBeTruthy()
  })

  test('renders Leyline Press link', () => {
    render(<Footer poweredBySalvageUrl="/test-logo.webp" />)
    const links = screen.getAllByRole('link')
    const leylineLink = links.find((l) => l.getAttribute('href') === 'https://leyline.press')
    expect(leylineLink).toBeTruthy()
  })

  test('renders OGL link', () => {
    render(<Footer poweredBySalvageUrl="/test-logo.webp" />)
    const links = screen.getAllByRole('link')
    const oglLink = links.find((l) =>
      l.getAttribute('href')?.includes('salvage-union-open-game-licence')
    )
    expect(oglLink).toBeTruthy()
  })

  test('renders image permission notice', () => {
    render(<Footer poweredBySalvageUrl="/test-logo.webp" />)
    expect(screen.getByText(/Workshop Manual Images/)).toBeTruthy()
  })

  test('renders Powered by Salvage logo with provided URL', () => {
    render(<Footer poweredBySalvageUrl="/my-logo.webp" />)
    const img = screen.getByAltText('Powered by Salvage')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('/my-logo.webp')
  })

  test('all external links open in new tab', () => {
    render(<Footer poweredBySalvageUrl="/test-logo.webp" />)
    const external = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href')?.startsWith('http'))
    expect(external.length).toBeGreaterThan(0)
    for (const link of external) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    }
  })

  // The site's own pages left the Union bar when the SRD dropped its second
  // nav row (brand refresh P2a); the footer is where they live now, same tab.
  test('links the site pages: Changelog, API, Discord and About', () => {
    render(<Footer poweredBySalvageUrl="/test-logo.webp" />)
    const site = within(screen.getByRole('navigation', { name: 'Site' }))
    for (const [name, href] of [
      ['Changelog', '/changelog/'],
      ['API', '/api/'],
      ['Discord', '/discord/'],
      ['About', '/about/'],
    ] as const) {
      const link = site.getByRole('link', { name })
      expect(link.getAttribute('href')).toBe(href)
      expect(link.getAttribute('target')).toBeNull()
    }
  })
})
