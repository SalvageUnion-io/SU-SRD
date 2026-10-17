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
    expect(container.querySelector('.su-entity-row__frame')).not.toBeNull()
    expect(container.querySelector('.su-entity-row__head')).toBeNull()
    const body = container.querySelector('.su-box__body')
    expect(body?.textContent).toBe('Body')
    expect(body?.hasAttribute('data-flush')).toBe(false)
  })

  test('takes a head, an art column and a frame colour', () => {
    const { container } = render(
      <Box
        head={<div className="head">Head</div>}
        art={<div className="art" />}
        frameColor="var(--color-sheet-mech)"
        body="flush"
      >
        Body
      </Box>
    )
    const frame = container.querySelector<HTMLElement>('.su-entity-row__frame')
    expect(frame?.style.borderColor).toBe('var(--color-sheet-mech)')
    expect(frame?.firstElementChild?.className).toBe('art')
    expect(container.querySelector('.su-entity-row__main > .head')).not.toBeNull()
    expect(container.querySelector('.su-box__body')?.hasAttribute('data-flush')).toBe(true)
  })

  test('closes on its head with no body', () => {
    const { container } = render(<Box head={<div>Head</div>} />)
    expect(container.querySelector('[data-bodyless]')).not.toBeNull()
    expect(container.querySelector('.su-box__body')).toBeNull()
  })
})
