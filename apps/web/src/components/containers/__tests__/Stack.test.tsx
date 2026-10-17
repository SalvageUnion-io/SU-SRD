import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Stack } from '../Stack'

describe('Stack', () => {
  test('is a div wearing the stack class, its gap a space step', () => {
    const { container } = render(
      <Stack gap={12}>
        <span>a</span>
        <span>b</span>
      </Stack>
    )
    const stack = container.firstElementChild as HTMLElement
    expect(stack.tagName).toBe('DIV')
    expect(stack.className).toBe('su-stack')
    expect(stack.dataset.gap).toBe('12')
    expect(stack.children).toHaveLength(2)
  })

  test('renders as a section, keeping its own attributes, class and style', () => {
    const { container } = render(
      <Stack as="section" gap={16} aria-label="Crew" className="extra" style={{ padding: '8px' }}>
        x
      </Stack>
    )
    const stack = container.firstElementChild as HTMLElement
    expect(stack.tagName).toBe('SECTION')
    expect(stack.getAttribute('aria-label')).toBe('Crew')
    expect(stack.className).toBe('su-stack extra')
    expect(stack.style.padding).toBe('8px')
  })
})
