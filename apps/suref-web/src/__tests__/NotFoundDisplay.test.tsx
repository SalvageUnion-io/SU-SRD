import { describe, test, expect, mock } from 'bun:test'
import { render, screen, fireEvent } from '../test/render'
import { NotFoundDisplay } from '../components/entity/NotFoundDisplay'
import { act } from '@testing-library/react'

describe('NotFoundDisplay', () => {
  test('renders default message when no props provided', async () => {
    await act(async () => {
      await render(<NotFoundDisplay />)
    })

    expect(screen.getByText('DATA NOT FOUND')).toBeDefined()
    expect(screen.getByText(/could not be found in the reference data/)).toBeDefined()
  })

  test('renders entity type and ID when both provided', async () => {
    await act(async () => {
      await render(<NotFoundDisplay entityType="System" entityId="test-id-123" />)
    })

    expect(screen.getByText('DATA NOT FOUND')).toBeDefined()
    expect(screen.getByText(/System "test-id-123"/)).toBeDefined()
  })

  test('renders only entity ID when entityType is not provided', async () => {
    await act(async () => {
      await render(<NotFoundDisplay entityId="my-entity-id" />)
    })

    expect(screen.getByText(/item "my-entity-id"/)).toBeDefined()
  })

  test('renders Close button when onClose is provided', async () => {
    const mockOnClose = mock(() => {})

    await act(async () => {
      await render(<NotFoundDisplay onClose={mockOnClose} />)
    })

    const closeButton = screen.getByRole('button', { name: /close/i })
    expect(closeButton).toBeDefined()
  })

  test('does not render Close button when onClose is not provided', async () => {
    await act(async () => {
      await render(<NotFoundDisplay />)
    })

    expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
  })

  test('calls onClose when Close button is clicked', async () => {
    const mockOnClose = mock(() => {})

    await act(async () => {
      await render(<NotFoundDisplay onClose={mockOnClose} />)
    })

    const closeButton = screen.getByRole('button', { name: /close/i })
    await act(async () => {
      fireEvent.click(closeButton)
    })

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  test('shows helpful message about broken links', async () => {
    await act(async () => {
      await render(<NotFoundDisplay />)
    })

    expect(screen.getByText(/broken link|data may have been removed/i)).toBeDefined()
  })
})
