import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { ActivationCost } from '../ActivationCost'

/**
 * The cost box's Size is a class on the box and its edge, never an inline
 * type size or inset, so a host's stylesheet resizes it per breakpoint by
 * specificity alone (`reference-card.css`'s band chips), with no `!important`.
 */
describe('ActivationCost', () => {
  for (const size of ['mini', 'compact', 'full', 'og'] as const) {
    test(`the ${size} rung is a class on the box and its edge`, () => {
      const { container } = render(<ActivationCost cost={2} size={size} />)
      const edge = container.querySelector('.su-cost-edge') as HTMLElement
      const box = container.querySelector('.su-cost') as HTMLElement
      expect(edge.classList.contains(`su-cost-edge--${size}`)).toBe(true)
      expect(box.classList.contains(`su-cost--${size}`)).toBe(true)
      expect(edge.style.fontSize).toBe('')
      expect(box.style.fontSize).toBe('')
      expect(box.style.paddingInlineStart).toBe('')
    })
  }

  test('the default rung is compact', () => {
    const { container } = render(<ActivationCost cost={3} />)
    expect(container.querySelector('.su-cost--compact')?.textContent).toBe('3 AP')
  })
})
