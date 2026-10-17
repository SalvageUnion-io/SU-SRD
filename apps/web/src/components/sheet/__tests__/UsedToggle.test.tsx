import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { UsedToggle } from '../UsedToggle'

describe('UsedToggle', () => {
  test('one pencil look in both states: the words stay, the press carries it', () => {
    const { rerender } = render(
      <UsedToggle used={false} onToggle={() => {}} aria-label="Mark motto used" />
    )
    const free = screen.getByRole('button', { name: 'Mark motto used' })
    expect(free.getAttribute('aria-pressed')).toBe('false')
    expect(free.className).toContain('su-btn--pencil')
    expect(free.className).toContain('su-btn--compact')
    expect(free.textContent).toBe('Used')

    rerender(<UsedToggle used onToggle={() => {}} aria-label="Reset motto used" size="mini" />)
    const used = screen.getByRole('button', { name: 'Reset motto used' })
    expect(used.getAttribute('aria-pressed')).toBe('true')
    expect(used.className).toContain('su-btn--mini')
    expect(used.textContent).toBe('Used')
  })

  test('a press asks for the other state', () => {
    const onToggle = mock((_next: boolean) => {})
    render(<UsedToggle used onToggle={onToggle} aria-label="Recharge Hack" />)
    fireEvent.click(screen.getByRole('button', { name: 'Recharge Hack' }))
    expect(onToggle).toHaveBeenCalledWith(false)
  })
})
