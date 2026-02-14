import { describe, test, expect } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from '../Card'

describe('Card', () => {
  test('renders title', () => {
    render(<Card title="Test Card" />)
    expect(screen.getByText('Test Card')).toBeTruthy()
  })

  test('renders children', () => {
    render(
      <Card title="Parent">
        <p>Child content</p>
      </Card>
    )
    expect(screen.getByText('Child content')).toBeTruthy()
  })

  test('renders label', () => {
    render(<Card title="Card" label="Section" />)
    expect(screen.getByText('Section')).toBeTruthy()
  })

  test('calls onHeaderClick when header is clicked', () => {
    let clicked = false
    render(<Card title="Clickable" onHeaderClick={() => (clicked = true)} />)
    fireEvent.click(screen.getByRole('button'))
    expect(clicked).toBe(true)
  })

  test('renders without header when no title or content props', () => {
    const { container } = render(
      <Card>
        <p>Body only</p>
      </Card>
    )
    expect(screen.getByText('Body only')).toBeTruthy()
    expect(container.querySelector('[role="button"]')).toBeNull()
  })
})
