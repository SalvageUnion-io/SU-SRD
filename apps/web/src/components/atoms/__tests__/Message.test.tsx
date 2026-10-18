import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { FieldError } from '../FieldError'
import { Message } from '../Message'

describe('Message', () => {
  test('bad is an alert in the danger ink, a class the ground recolours (chrome K1)', () => {
    render(<Message tone="bad">It failed.</Message>)
    const line = screen.getByRole('alert')
    expect(line.textContent).toBe('It failed.')
    expect(line.className).toBe('su-message--bad')
    expect(line.style.color).toBe('')
  })

  test('spaceAbove sets the margin from the space scale', () => {
    render(
      <Message tone="bad" spaceAbove={12}>
        It failed.
      </Message>
    )
    expect(screen.getByRole('alert').style.marginTop).toBe('12px')
  })

  test('an empty message renders nothing', () => {
    const { container } = render(<Message tone="bad">{null}</Message>)
    expect(container.firstChild).toBeNull()
  })
})

describe('FieldError', () => {
  test('is the bad Message', () => {
    render(<FieldError spaceAbove={8}>Required.</FieldError>)
    const line = screen.getByRole('alert')
    expect(line.className).toBe('su-message--bad')
    expect(line.style.marginTop).toBe('8px')
  })
})
