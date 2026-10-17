import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../EmptyState'

describe('EmptyState variant="inline"', () => {
  test('is one unframed line', () => {
    const { container } = render(<EmptyState variant="inline" body="No Games yet" />)
    const line = container.firstElementChild as HTMLElement
    expect(line.tagName).toBe('P')
    expect(line.textContent).toBe('No Games yet')
    expect(line.style.borderStyle).toBe('')
  })

  test('prints in the muted ink, or the ground’s with bodyInk="inherit"', () => {
    render(<EmptyState variant="inline" body="Muted" />)
    expect(screen.getByText('Muted').style.color).toBe('rgb(107, 98, 87)')
    render(<EmptyState variant="inline" body="Inherited" bodyInk="inherit" />)
    expect(screen.getByText('Inherited').style.color).toBe('currentcolor')
  })
})
