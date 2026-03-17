import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { DowntimeWaitState } from '../DowntimeWaitState'

describe('DowntimeWaitState', () => {
  test('renders the message text', () => {
    render(<DowntimeWaitState message="Waiting for Mediator..." />)
    expect(screen.getByText('Waiting for Mediator...')).toBeTruthy()
  })

  test('has role="status" on the root element', () => {
    render(<DowntimeWaitState message="Waiting..." />)
    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeTruthy()
  })

  test('renders a static icon (not a spinner)', () => {
    const { container } = render(<DowntimeWaitState message="Waiting..." />)
    // Spinner uses animate-spin class — static icon must NOT have it
    const spinners = container.querySelectorAll('.animate-spin')
    expect(spinners.length).toBe(0)
    // Should have an SVG icon
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  test('renders orientation copy when provided', () => {
    render(
      <DowntimeWaitState
        message="Waiting for Mediator..."
        orientationCopy="While you wait, review what you offloaded."
      />
    )
    expect(screen.getByText('While you wait, review what you offloaded.')).toBeTruthy()
  })

  test('does not render orientation copy when omitted', () => {
    const { container } = render(<DowntimeWaitState message="Waiting..." />)
    // Only message text — no extra paragraph
    const texts = container.querySelectorAll('p, span')
    const allText = Array.from(texts).map((el) => el.textContent)
    expect(allText.some((t) => t && t.includes('While you wait'))).toBe(false)
  })
})
