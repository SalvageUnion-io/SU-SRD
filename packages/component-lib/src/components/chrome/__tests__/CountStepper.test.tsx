/**
 * CountStepper tests — the `[− n +]` duplicate-quantity control extracted from
 * the former SelCard count-stepper. Guards the accessible names, the sr-only
 * count announcement, and the min/max bounds.
 */
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CountStepper } from '../CountStepper'

afterEach(cleanup)

describe('CountStepper', () => {
  it('announces the count and labels the ± controls by subject', () => {
    render(<CountStepper subject="Combat Knife" count={2} onChange={() => {}} max={3} />)
    expect(screen.getByRole('status').textContent).toBe('Combat Knife count: 2')
    expect(screen.getByRole('button', { name: 'Add one Combat Knife' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove one Combat Knife' })).toBeTruthy()
  })

  it('emits count ± 1 on the buttons', () => {
    const onChange = mock(() => {})
    render(<CountStepper subject="Med Kit" count={1} onChange={onChange} max={3} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add one Med Kit' }))
    expect(onChange).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: 'Remove one Med Kit' }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('disables − at the floor and + at the ceiling', () => {
    const { rerender } = render(
      <CountStepper subject="Med Kit" count={0} onChange={() => {}} max={2} />
    )
    const mustButton = (el: HTMLElement): HTMLButtonElement => {
      if (!(el instanceof HTMLButtonElement)) throw new Error('expected a <button> element')
      return el
    }
    const removeBtn = () => mustButton(screen.getByRole('button', { name: 'Remove one Med Kit' }))
    const addBtn = () => mustButton(screen.getByRole('button', { name: 'Add one Med Kit' }))
    expect(removeBtn().disabled).toBe(true)
    expect(addBtn().disabled).toBe(false)
    rerender(<CountStepper subject="Med Kit" count={2} onChange={() => {}} max={2} />)
    expect(addBtn().disabled).toBe(true)
  })
})
