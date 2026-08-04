import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
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
    const links = screen.getAllByRole('link')
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    }
  })
})
