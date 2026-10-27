import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { FieldError } from '../FieldError'

describe('FieldError', () => {
  test('is an alert in the danger ink, a class the ground recolours (chrome K1)', () => {
    render(<FieldError>It failed.</FieldError>)
    const line = screen.getByRole('alert')
    expect(line.textContent).toBe('It failed.')
    expect(line.className).toBe('su-message--bad')
    expect(line.style.color).toBe('')
  })

  test('spaceAbove sets the margin from the space scale', () => {
    render(<FieldError spaceAbove={12}>It failed.</FieldError>)
    expect(screen.getByRole('alert').style.marginTop).toBe('12px')
  })

  test('an empty message renders nothing', () => {
    const { container } = render(<FieldError>{null}</FieldError>)
    expect(container.firstChild).toBeNull()
  })
})
