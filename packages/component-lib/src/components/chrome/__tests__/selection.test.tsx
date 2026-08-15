import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SELECTION_RING } from '../interaction'
import { Sel } from '../Sel'

describe('Sel', () => {
  test('selection ring toggles without layout shift (box-shadow only)', () => {
    const { container, rerender } = render(
      <Sel selected={false}>
        <div>card</div>
      </Sel>
    )
    expect(container.firstElementChild?.className).not.toContain(SELECTION_RING)
    rerender(
      <Sel selected>
        <div>card</div>
      </Sel>
    )
    expect(container.firstElementChild?.className).toContain(SELECTION_RING)
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
