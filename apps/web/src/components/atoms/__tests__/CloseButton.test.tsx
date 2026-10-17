/**
 * CloseButton is the one ×: Button's icon rung, named for a screen reader,
 * quiet by default and the ink stamp on request, with a paper flag the
 * stylesheet reads (a coarse pointer lifts the compact rung to 44px).
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { CloseButton } from '../CloseButton'

describe('CloseButton', () => {
  test('is a quiet icon button named Close', () => {
    const onClick = mock(() => {})
    render(<CloseButton onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Close' })
    expect(button.className).toContain('su-btn--quiet')
    expect(button.className).toContain('su-btn--icon-only')
    expect(button.hasAttribute('data-on-paper')).toBe(false)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('takes a label, the stamp look and the paper flag', () => {
    render(<CloseButton label="Close menu" look="stamp" onPaper />)
    const button = screen.getByRole('button', { name: 'Close menu' })
    expect(button.className).toContain('su-btn--ink')
    expect(button.hasAttribute('data-on-paper')).toBe(true)
  })
})
