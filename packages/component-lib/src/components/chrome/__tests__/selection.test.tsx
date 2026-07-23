import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Sel } from '../Sel'

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
