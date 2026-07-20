import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Sel } from '../Sel'
import { OptRow } from '../OptRow'

afterEach(cleanup)

describe('Sel', () => {
  test('selection ring toggles without layout shift (box-shadow only)', () => {
    const { container, rerender } = render(
      <Sel selected={false}>
        <div>card</div>
      </Sel>
    )
    expect(container.firstElementChild?.className).not.toContain('shadow-[0_0_0_3px')
    rerender(
      <Sel selected>
        <div>card</div>
      </Sel>
    )
    expect(container.firstElementChild?.className).toContain('shadow-[0_0_0_3px')
  })

  test('onToggle makes the wrapper keyboard-operable', () => {
    const onToggle = mock(() => {})
    render(
      <Sel selected={false} onToggle={onToggle} ariaLabel="Engineering Expertise">
        <div>card</div>
      </Sel>
    )
    const wrapper = screen.getByRole('button', {
      name: 'Engineering Expertise',
    })
    fireEvent.keyDown(wrapper, { key: ' ' })
    expect(onToggle).toHaveBeenCalled()
  })
})

describe('OptRow', () => {
  test('renders name + clamped desc, active shows rust caret and inset bar', () => {
    render(<OptRow name="Iron Mongrel" desc="A reliable workhorse chassis." active />)
    expect(screen.getByText('Iron Mongrel')).toBeTruthy()
    expect(screen.getByText('▸')).toBeTruthy()
    expect(screen.getByRole('button').className).toContain(
      'shadow-[inset_3px_0_0_var(--color-rust)]'
    )
    expect(screen.getByRole('button').getAttribute('aria-current')).toBe('true')
  })

  test('inactive row has no caret', () => {
    render(<OptRow name="Iron Mongrel" />)
    expect(screen.queryByText('▸')).toBeNull()
  })
})
