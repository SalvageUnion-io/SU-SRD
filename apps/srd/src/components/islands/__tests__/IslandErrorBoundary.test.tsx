import { describe, expect, spyOn, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { IslandErrorBoundary } from '../IslandErrorBoundary'

function Bomb(): never {
  throw new Error('boom')
}

describe('IslandErrorBoundary', () => {
  test('renders children when nothing throws', () => {
    render(
      <IslandErrorBoundary>
        <div>safe content</div>
      </IslandErrorBoundary>
    )
    expect(screen.getByText('safe content')).toBeTruthy()
  })

  test('renders fallback UI with a reload button when a child throws', () => {
    // React logs caught boundary errors via console.error — silence the noise
    const consoleError = spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <IslandErrorBoundary>
          <Bomb />
        </IslandErrorBoundary>
      )
      expect(screen.getByText('Something went wrong rendering this entry.')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy()
    } finally {
      consoleError.mockRestore()
    }
  })
})
