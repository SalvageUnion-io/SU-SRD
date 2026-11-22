import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { Checkbox } from '../Checkbox'

describe('Checkbox', () => {
  test('a native 24px checkbox with the focus ring, ticked in ink by default', () => {
    render(<Checkbox aria-label="Carry Hack" checked={false} onChange={() => {}} />)
    const box = screen.getByRole('checkbox', { name: 'Carry Hack' }) as HTMLInputElement
    expect(box.type).toBe('checkbox')
    expect(box.className).toContain('su-focus-ring')
    expect(box.style.width).toBe('var(--space-24)')
    expect(box.style.height).toBe('var(--space-24)')
    expect(box.style.accentColor).toBe('var(--color-ink)')
  })

  // MD4-11: only the 24px box toggled; the words beside it did nothing.
  test('with words beside it, they name it and pressing them toggles it', () => {
    const onChange = mock(() => {})
    render(<Checkbox words="Reset the invite link too" checked={false} onChange={onChange} />)
    expect(screen.getByRole('checkbox', { name: 'Reset the invite link too' })).toBeTruthy()
    fireEvent.click(screen.getByText('Reset the invite link too'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test('paints its tick in the given accent and reports a change', () => {
    const onChange = mock(() => {})
    render(<Checkbox aria-label="Pick" accent="red" checked={false} onChange={onChange} />)
    const box = screen.getByRole('checkbox', { name: 'Pick' }) as HTMLInputElement
    expect(box.style.accentColor).toBe('red')
    fireEvent.click(box)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
