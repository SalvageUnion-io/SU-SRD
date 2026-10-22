import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Box } from '../Box'

describe('Box', () => {
  test('is the square frame around a padded paper body, with no head of its own', () => {
    const { container } = render(
      <Box>
        <p>Body</p>
      </Box>
    )
    expect(container.querySelector('.su-entity-compact__frame')).not.toBeNull()
    expect(container.querySelector('.su-entity-compact__head')).toBeNull()
    const body = container.querySelector('.su-box__body')
    expect(body?.textContent).toBe('Body')
    expect(body?.hasAttribute('data-flush')).toBe(false)
  })

  test('takes a head and a frame colour', () => {
    const { container } = render(
      <Box
        head={<div className="head">Head</div>}
        frameColor="var(--color-sheet-mech)"
        body="flush"
      >
        Body
      </Box>
    )
    const frame = container.querySelector<HTMLElement>('.su-entity-compact__frame')
    expect(frame?.style.getPropertyValue('--su-compact-frame')).toBe('var(--color-sheet-mech)')
    expect(container.querySelector('.su-entity-compact__main > .head')).not.toBeNull()
    expect(container.querySelector('.su-box__body')?.hasAttribute('data-flush')).toBe(true)
  })

  test('a hairline frame is one hairline all round, never the unit colour on top (R49)', () => {
    const { container } = render(
      <Box as="section" label="Identity" frame="hairline">
        <p>Tenacity</p>
      </Box>
    )
    const frame = container.querySelector<HTMLElement>('.su-entity-compact__frame')
    expect(frame?.style.borderWidth).toBe('1px')
    expect(frame?.getAttribute('style') ?? '').not.toContain('--tone')
    expect(container.querySelector('section[aria-label="Identity"]')).not.toBeNull()
  })

  test('closes on its head with no body', () => {
    const { container } = render(<Box head={<div>Head</div>} />)
    expect(container.querySelector('[data-bodyless]')).not.toBeNull()
    expect(container.querySelector('.su-box__body')).toBeNull()
  })

  // R7: a host says what it needs through these, never by reaching into the frame.
  test('marks a reference frame and a fill on its own elements', () => {
    const { container } = render(
      <Box reference fill>
        Body
      </Box>
    )
    expect(container.querySelector('.su-box')?.hasAttribute('data-fill')).toBe(true)
    expect(
      container.querySelector('.su-entity-compact__frame')?.hasAttribute('data-reference')
    ).toBe(true)
    // A fill shrinks the frame and scrolls the body: the Compact frame's own `shrink`.
    expect(container.querySelector('.su-entity-compact__frame')?.hasAttribute('data-shrink')).toBe(
      true
    )
    expect(container.querySelector('.su-box__body')?.hasAttribute('data-fill')).toBe(true)
    const plain = render(<Box>Body</Box>).container
    expect(plain.querySelector('[data-fill], [data-reference], [data-shrink]')).toBeNull()
  })

  test('shrinks its frame with a capped root, its body left as it is', () => {
    const { container } = render(<Box shrink>Body</Box>)
    expect(container.querySelector('.su-entity-compact__frame')?.hasAttribute('data-shrink')).toBe(
      true
    )
    expect(container.querySelector('[data-fill]')).toBeNull()
  })
})
