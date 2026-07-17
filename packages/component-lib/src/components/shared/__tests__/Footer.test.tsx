import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { Footer } from '../Footer'

describe('Footer', () => {
  afterEach(cleanup)
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

  test('omits legal links when none are provided', () => {
    render(<Footer poweredBySalvageUrl="/test-logo.webp" />)
    expect(screen.queryByText('Bot Terms')).toBeNull()
  })

  test('renders provided legal links as same-tab internal links', () => {
    render(
      <Footer
        poweredBySalvageUrl="/test-logo.webp"
        legalLinks={[
          { label: 'Bot Terms', href: '/bot/terms' },
          { label: 'Bot Privacy', href: '/bot/privacy' },
        ]}
      />
    )
    const terms = screen.getByText('Bot Terms')
    expect(terms.getAttribute('href')).toBe('/bot/terms')
    // Internal links must NOT open a new tab.
    expect(terms.getAttribute('target')).toBeNull()
    expect(screen.getByText('Bot Privacy').getAttribute('href')).toBe('/bot/privacy')
  })
})
