import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { Skeleton } from '../Skeleton'

afterEach(cleanup)

describe('Skeleton', () => {
  test('every mode exposes a loading status', () => {
    for (const mode of ['card', 'list', 'text'] as const) {
      render(<Skeleton mode={mode} />)
      expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
      cleanup()
    }
  })

  test('list mode renders one ghost row per `rows`', () => {
    const { container } = render(<Skeleton mode="list" rows={4} />)
    // Each row is a bordered flex container under the status root.
    const rows = container.querySelectorAll('.border-chrome')
    expect(rows.length).toBe(4)
  })
})
