import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { InlineEditField } from '../InlineEditField'

/**
 * The edit-in-place atom every sheet value goes through. It owns the whole
 * commit path — open, validate, save or refuse — so the things worth pinning
 * are the ones that quietly lose a player's typing: a commit that fires on
 * blur as well as Enter, an Escape that must NOT save, and a rejected number
 * that must keep the editor open with the draft intact rather than reverting.
 *
 * `readOnly` gets its own attention because it is a correctness boundary, not
 * a style: the read-only sheet must not offer an affordance that would write.
 */

// Explicit rather than relying on Testing Library's auto-cleanup: every test
// here renders the same `Callsign` label, so a single leaked render turns every
// later `getByLabelText` into "found multiple elements". Auto-cleanup covered
// this when the file ran alone and did not when the whole suite ran together.
afterEach(cleanup)

/** Render with a recording `onSave`; returns the calls array. */
function setup(props: Partial<Parameters<typeof InlineEditField>[0]> = {}) {
  const saved: Array<string | number> = []
  render(
    <InlineEditField
      value={props.value ?? 'Roach-Boy'}
      onSave={(next) => {
        saved.push(next)
      }}
      ariaLabel="Callsign"
      {...props}
    />
  )
  return saved
}

/** Open the editor by activating the display readout. */
function openEditor(label = 'Callsign'): void {
  fireEvent.click(screen.getByLabelText(label))
}

describe('the readout, before anything is edited', () => {
  test('shows the value', () => {
    setup()
    expect(screen.getByLabelText('Callsign').textContent).toBe('Roach-Boy')
  })

  test('an empty value shows the placeholder', () => {
    setup({ value: '', placeholder: 'Unnamed' })
    expect(screen.getByLabelText('Callsign').textContent).toBe('Unnamed')
  })

  test('an empty value with no placeholder shows a dash, never nothing', () => {
    // A blank cell on a sheet reads as a rendering bug rather than as an
    // empty field waiting to be filled.
    setup({ value: '   ' })
    expect(screen.getByLabelText('Callsign').textContent).toBe('—')
  })

  test('a zero is a value, not an empty', () => {
    setup({ value: 0, type: 'number', placeholder: 'none' })
    expect(screen.getByLabelText('Callsign').textContent).toBe('0')
  })
})

describe('opening the editor', () => {
  test('clicking the readout opens an input carrying the current value', () => {
    setup()
    openEditor()
    expect((screen.getByLabelText('Callsign') as HTMLInputElement).value).toBe('Roach-Boy')
  })

  test('Enter and Space open it from the keyboard', () => {
    setup()
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })
    expect(screen.getByLabelText('Callsign').tagName).toBe('INPUT')
  })

  test('Space opens it too', () => {
    setup()
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: ' ' })
    expect(screen.getByLabelText('Callsign').tagName).toBe('INPUT')
  })

  test('another key does not', () => {
    setup()
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'a' })
    expect(screen.getByLabelText('Callsign').tagName).not.toBe('INPUT')
  })
})

describe('read-only', () => {
  test('offers no way in — not a disabled one, none at all', () => {
    setup({ readOnly: true })
    const node = screen.getByLabelText('Callsign')

    // No button role and no tab stop: a read-only sheet must not put a
    // write affordance in the keyboard order at all.
    expect(node.getAttribute('role')).toBeNull()
    expect(node.getAttribute('tabindex')).toBeNull()

    fireEvent.click(node)
    fireEvent.keyDown(node, { key: 'Enter' })
    expect(screen.getByLabelText('Callsign').tagName).not.toBe('INPUT')
  })
})

describe('committing', () => {
  test('Enter saves the typed value', async () => {
    const saved = setup()
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: 'Ash' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })

    await waitFor(() => expect(saved).toEqual(['Ash']))
  })

  test('blur saves too — clicking away must not discard typing', async () => {
    const saved = setup()
    openEditor()
    fireEvent.blur(screen.getByLabelText('Callsign'), { target: { value: 'Ash' } })

    await waitFor(() => expect(saved).toEqual(['Ash']))
  })

  test('the editor closes and the new value is read back', async () => {
    setup()
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: 'Ash' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })

    await waitFor(() => expect(screen.getByLabelText('Callsign').tagName).not.toBe('INPUT'))
  })

  test('Escape closes without saving', async () => {
    const saved = setup()
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: 'discard me' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Escape' })

    await waitFor(() => expect(screen.getByLabelText('Callsign').tagName).not.toBe('INPUT'))
    expect(saved).toEqual([])
  })

  test('reopening after Escape shows the stored value, not the abandoned draft', () => {
    setup()
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: 'discard me' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Escape' })

    openEditor()
    expect((screen.getByLabelText('Callsign') as HTMLInputElement).value).toBe('Roach-Boy')
  })
})

describe('number validation', () => {
  test('a valid number is saved as a number, not a string', async () => {
    // Stats are arithmetic downstream; a string here corrupts every sum.
    const saved = setup({ value: 5, type: 'number', min: 0, max: 10 })
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: '7' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })

    await waitFor(() => expect(saved).toEqual([7]))
  })

  test('a non-number is refused, and the editor stays open', async () => {
    const saved = setup({ value: 5, type: 'number' })
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: 'abc' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('Must be a number.')).toBeTruthy())
    expect(saved).toEqual([])
    // Still editing — closing here would silently drop what they typed.
    expect(screen.getByLabelText('Callsign').tagName).toBe('INPUT')
  })

  test('an empty number is refused rather than saved as zero', async () => {
    const saved = setup({ value: 5, type: 'number' })
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: '  ' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('Must be a number.')).toBeTruthy())
    expect(saved).toEqual([])
  })

  test('below min is refused, and the bound is named', async () => {
    const saved = setup({ value: 5, type: 'number', min: 1 })
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: '0' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('min 1')).toBeTruthy())
    expect(saved).toEqual([])
  })

  test('above max is refused, and the bound is named', async () => {
    const saved = setup({ value: 5, type: 'number', max: 10 })
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: '11' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('max 10')).toBeTruthy())
    expect(saved).toEqual([])
  })

  test('the error clears as soon as they start fixing it', async () => {
    const saved = setup({ value: 5, type: 'number', max: 10 })
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: '11' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('max 10')).toBeTruthy())

    // Nagging while somebody is mid-correction is the wrong moment for it.
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: '9' } })
    expect(screen.queryByText('max 10')).toBeNull()

    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })
    await waitFor(() => expect(saved).toEqual([9]))
  })

  test('a text field does not validate as a number', async () => {
    const saved = setup({ value: 'a' })
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: 'not a number' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })

    await waitFor(() => expect(saved).toEqual(['not a number']))
  })
})

describe('multiline', () => {
  test('edits in a textarea', () => {
    setup({ multiline: true })
    openEditor()
    expect(screen.getByLabelText('Callsign').tagName).toBe('TEXTAREA')
  })

  test('Enter commits', async () => {
    const saved = setup({ multiline: true })
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: 'a motto' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })

    await waitFor(() => expect(saved).toEqual(['a motto']))
  })

  test('Shift+Enter inserts a newline instead of committing', () => {
    // The whole point of a textarea: prose fields need paragraph breaks.
    const saved = setup({ multiline: true })
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: 'line one' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter', shiftKey: true })

    expect(saved).toEqual([])
    expect(screen.getByLabelText('Callsign').tagName).toBe('TEXTAREA')
  })

  test('Escape cancels', async () => {
    const saved = setup({ multiline: true })
    openEditor()
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Escape' })

    await waitFor(() => expect(screen.getByLabelText('Callsign').tagName).not.toBe('TEXTAREA'))
    expect(saved).toEqual([])
  })

  test('blur commits', async () => {
    const saved = setup({ multiline: true })
    openEditor()
    fireEvent.blur(screen.getByLabelText('Callsign'), { target: { value: 'via blur' } })

    await waitFor(() => expect(saved).toEqual(['via blur']))
  })
})

describe('bordered value box', () => {
  test('at rest the box draws the frame around the readout', () => {
    const { container } = render(
      <InlineEditField value="Roach-Boy" onSave={() => {}} ariaLabel="Callsign" bordered />
    )
    const box = container.firstElementChild as HTMLElement
    expect(box.className).toContain('border-ink')
  })

  test('while editing the box does not draw a second border around the input', () => {
    // The input supplies its own frame; a box-in-box is the bug this guards.
    const { container } = render(
      <InlineEditField value="Roach-Boy" onSave={() => {}} ariaLabel="Callsign" bordered />
    )
    openEditor()
    const box = container.firstElementChild as HTMLElement
    expect(box.className).not.toContain('border-ink')
  })

  test('an awaited async save still returns to the readout', async () => {
    const saved: Array<string | number> = []
    render(
      <InlineEditField
        value="Roach-Boy"
        ariaLabel="Callsign"
        bordered
        onSave={async (next) => {
          await Promise.resolve()
          saved.push(next)
        }}
      />
    )
    openEditor()
    fireEvent.change(screen.getByLabelText('Callsign'), { target: { value: 'Ash' } })
    fireEvent.keyDown(screen.getByLabelText('Callsign'), { key: 'Enter' })

    await waitFor(() => expect(saved).toEqual(['Ash']))
    expect(screen.getByLabelText('Callsign').tagName).not.toBe('INPUT')
  })
})
