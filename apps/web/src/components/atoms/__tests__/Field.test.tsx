import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { Field } from '../Field'

describe('Field', () => {
  test('static: the stamp labels a caller-supplied control', () => {
    render(
      <Field label="Callsign" htmlFor="callsign" required labelAction={<span>Roll</span>}>
        <input id="callsign" />
      </Field>
    )
    expect(screen.getByLabelText(/Callsign/)).toBeTruthy()
    expect(screen.getByText('Roll')).toBeTruthy()
    expect(screen.getByText('*')).toBeTruthy()
  })

  test('typeset: with no handler it prints label over value, and nothing when empty', () => {
    const { container, rerender } = render(<Field label="Quirk" value="Bulky" />)
    expect(container.textContent).toBe('QuirkBulky')
    expect(container.querySelector('button')).toBeNull()
    rerender(<Field label="Quirk" value="  " />)
    expect(container.firstChild).toBeNull()
  })

  test('picker: the value is a button that opens the caller’s modal', () => {
    const onEditClick = mock(() => {})
    render(<Field label="Chassis" value="" placeholder="None" onEditClick={onEditClick} />)
    const button = screen.getByRole('button', { name: 'Change chassis' })
    expect(button.textContent).toBe('None')
    expect(button.getAttribute('data-print')).toBe('keep')
    fireEvent.click(button)
    expect(onEditClick).toHaveBeenCalledTimes(1)
  })

  test('edit-in-place: an inline editor that saves the string', () => {
    const onSave = mock((_: string) => {})
    render(<Field label="Pattern name" value="Mule" onSave={onSave} prominent fill />)
    expect(screen.getByLabelText('Edit pattern name')).toBeTruthy()
  })
})
