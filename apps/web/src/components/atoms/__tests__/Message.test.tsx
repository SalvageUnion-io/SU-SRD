import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { FieldError } from '../FieldError'
import { Message } from '../Message'

describe('Message', () => {
  test('bad is an alert in the danger ink', () => {
    render(<Message tone="bad">It failed.</Message>)
    const line = screen.getByRole('alert')
    expect(line.textContent).toBe('It failed.')
    expect(line.style.color).toBe('rgb(176, 67, 43)')
  })

  test('every other tone is a status', () => {
    render(<Message tone="ok">Saved.</Message>)
    expect(screen.getByRole('status').textContent).toBe('Saved.')
  })

  test('on the ink ground it prints in paper', () => {
    render(
      <Message tone="bad" ground="ink">
        It failed.
      </Message>
    )
    expect(screen.getByRole('alert').style.color).not.toBe('rgb(176, 67, 43)')
  })

  test('spaceAbove sets the margin from the space scale', () => {
    render(
      <Message tone="info" spaceAbove={12}>
        Note.
      </Message>
    )
    expect(screen.getByRole('status').style.marginTop).toBe('12px')
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
    expect(line.style.color).toBe('rgb(176, 67, 43)')
    expect(line.style.marginTop).toBe('8px')
  })
})
