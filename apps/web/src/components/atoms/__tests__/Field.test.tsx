import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

/**
 * The edit state: a value box a press opens into its editor. It owns the whole
 * commit path, so the things worth pinning are the ones that quietly lose a
 * player's typing: a commit that fires on blur as well as Enter, and an Escape
 * that must NOT save.
 */
describe("Field's edit state", () => {
  /** Render with a recording `onSave`; returns the calls array. */
  function setup(props: { value?: string; placeholder?: string; multiline?: boolean } = {}) {
    const saved: string[] = []
    const result = render(
      <Field
        label="Callsign"
        value={props.value ?? 'Roach-Boy'}
        placeholder={props.placeholder}
        multiline={props.multiline}
        onSave={(next) => {
          saved.push(next)
        }}
      />
    )
    return { saved, ...result }
  }
  const control = () => screen.getByLabelText('Edit callsign')
  const open = () => fireEvent.click(control())

  test('the readout shows the value, else the placeholder, else a dash', () => {
    const { rerender } = setup()
    expect(control().textContent).toBe('Roach-Boy')
    rerender(<Field label="Callsign" value="" placeholder="Unnamed" onSave={() => {}} />)
    expect(control().textContent).toBe('Unnamed')
    // A blank cell on a sheet reads as a rendering bug, not a field to fill.
    rerender(<Field label="Callsign" value="   " onSave={() => {}} />)
    expect(control().textContent).toBe('—')
  })

  test('a press, Enter or Space opens an input carrying the value; another key does not', () => {
    setup()
    fireEvent.keyDown(control(), { key: 'a' })
    expect(control().tagName).not.toBe('INPUT')
    fireEvent.keyDown(control(), { key: ' ' })
    expect((control() as HTMLInputElement).value).toBe('Roach-Boy')
    fireEvent.keyDown(control(), { key: 'Escape' })
    fireEvent.keyDown(control(), { key: 'Enter' })
    expect(control().tagName).toBe('INPUT')
  })

  test('Enter saves the typed value and reads it back closed', async () => {
    const { saved } = setup()
    open()
    fireEvent.change(control(), { target: { value: 'Ash' } })
    fireEvent.keyDown(control(), { key: 'Enter' })
    await waitFor(() => expect(saved).toEqual(['Ash']))
    expect(control().tagName).not.toBe('INPUT')
  })

  test('blur saves too: clicking away must not discard typing', async () => {
    const { saved } = setup()
    open()
    fireEvent.blur(control(), { target: { value: 'Ash' } })
    await waitFor(() => expect(saved).toEqual(['Ash']))
  })

  test('Escape closes without saving, and reopening shows the stored value', async () => {
    const { saved } = setup()
    open()
    fireEvent.change(control(), { target: { value: 'discard me' } })
    fireEvent.keyDown(control(), { key: 'Escape' })
    await waitFor(() => expect(control().tagName).not.toBe('INPUT'))
    expect(saved).toEqual([])
    open()
    expect((control() as HTMLInputElement).value).toBe('Roach-Boy')
  })

  test('multiline edits in a textarea: Enter commits, Shift+Enter is a newline', async () => {
    const { saved } = setup({ multiline: true })
    open()
    expect(control().tagName).toBe('TEXTAREA')
    fireEvent.change(control(), { target: { value: 'line one' } })
    fireEvent.keyDown(control(), { key: 'Enter', shiftKey: true })
    expect(saved).toEqual([])
    fireEvent.keyDown(control(), { key: 'Enter' })
    await waitFor(() => expect(saved).toEqual(['line one']))
  })

  test('a multiline readout keeps its line breaks; a one-line one does not', () => {
    const { rerender } = setup({ value: 'line one\nline two', multiline: true })
    expect((control() as HTMLElement).style.whiteSpace).toBe('pre-line')
    rerender(<Field label="Callsign" value="Roach-Boy" onSave={() => {}} />)
    expect((control() as HTMLElement).style.whiteSpace).toBe('')
  })

  test('the border is drawn once: the box at rest, the input while editing', () => {
    const { container } = setup()
    expect(container.querySelector('.su-field__box')).not.toBeNull()
    expect(container.querySelector('.su-field__write-cue')).not.toBeNull()
    open()
    expect(container.querySelector('.su-field__box')).toBeNull()
  })
})
