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

  test('paints its tick in the given accent and reports a change', () => {
    const onChange = mock(() => {})
    render(<Checkbox aria-label="Pick" accent="red" checked={false} onChange={onChange} />)
    const box = screen.getByRole('checkbox', { name: 'Pick' }) as HTMLInputElement
    expect(box.style.accentColor).toBe('red')
    fireEvent.click(box)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
