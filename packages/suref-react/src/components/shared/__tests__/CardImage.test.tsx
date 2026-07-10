import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { CardImage } from '../CardImage'

describe('CardImage', () => {
  afterEach(cleanup)

  test('renders the alt attribute on the img element', () => {
    render(<CardImage url="https://example.com/image.png" alt="Iron Mongrel chassis" />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('alt')).toBe('Iron Mongrel chassis')
  })

  test('renders with an empty-string alt for decorative images', () => {
    // An img with alt="" gets role="presentation" per ARIA spec
    const { container } = render(<CardImage url="https://example.com/image.png" alt="" />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('alt')).toBe('')
  })
})
