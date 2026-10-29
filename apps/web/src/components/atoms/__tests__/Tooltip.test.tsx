import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Tooltip } from '../Tooltip'

describe('Tooltip', () => {
  test('an element trigger renders as itself', () => {
    const { container } = render(
      <Tooltip content="More">
        <button type="button">Max</button>
      </Tooltip>
    )
    expect(container.querySelector('button')?.textContent).toBe('Max')
  })

  test('a text trigger is wrapped in a span, never handed to Base UI bare', () => {
    const { container } = render(<Tooltip content="More">plain words</Tooltip>)
    expect(container.querySelector('span')?.textContent).toBe('plain words')
  })
})
