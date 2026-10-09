import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRef, useState } from 'react'
import { Fab } from '../Fab'

/**
 * Fab's contract is its ARIA, its dismissal and where it leaves focus — the
 * parts a caller would otherwise re-implement per corner control. Base UI's
 * Popover delivers them; these tests pin that the Fab wires it so. Content is
 * the caller's; a plain input stands in for it here.
 */

function Harness({ hidden = false }: { hidden?: boolean }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Elsewhere
      </button>
      <Fab
        label="Search the rules"
        icon={<span aria-hidden="true">?</span>}
        open={open}
        onOpenChange={setOpen}
        hidden={hidden}
        initialFocus={inputRef}
      >
        <input ref={inputRef} aria-label="Query" />
      </Fab>
    </>
  )
}

const button = () => screen.getByRole('button', { name: /Search the rules/ })
const panel = () => screen.queryByRole('dialog', { name: 'Search the rules' })
const query = () => screen.getByRole('textbox', { name: 'Query' })

async function press(el: Element) {
  await act(async () => {
    fireEvent.click(el)
  })
}

async function pressEscape(el: Element) {
  await act(async () => {
    fireEvent.keyDown(el, { key: 'Escape' })
  })
}

describe('Fab', () => {
  test('a collapsed button: expanded state, and no panel mounted', () => {
    render(<Harness />)
    expect(button().getAttribute('aria-expanded')).toBe('false')
    expect(button().getAttribute('aria-controls')).toBeNull()
    expect(panel()).toBeNull()
  })

  test('opening mounts a named, non-modal dialog the button controls, focused inside', async () => {
    render(<Harness />)
    await press(button())

    const dialog = panel()
    expect(dialog).toBeTruthy()
    expect(dialog?.getAttribute('aria-modal')).toBeNull()
    expect(button().getAttribute('aria-expanded')).toBe('true')
    expect(button().getAttribute('aria-controls')).toBe(dialog?.id ?? '')
    // While open the button is the panel's close, and says so.
    expect(button().getAttribute('aria-label')).toBe('Close: Search the rules')
    await waitFor(() => expect(document.activeElement).toBe(query()))
  })

  test('Escape inside the panel closes it, focus back on the button', async () => {
    render(<Harness />)
    await press(button())
    await pressEscape(query())
    expect(panel()).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(button()))
  })

  test('an outside press closes it; one inside does not', async () => {
    render(<Harness />)
    await press(button())
    await act(async () => {
      fireEvent.pointerDown(query())
      fireEvent.click(query())
    })
    expect(panel()).toBeTruthy()

    await act(async () => {
      fireEvent.pointerDown(document.body)
      fireEvent.click(document.body)
    })
    expect(panel()).toBeNull()
  })

  test('an outside press that lands on a focusable control keeps that focus', async () => {
    render(<Harness />)
    await press(button())
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    await act(async () => {
      fireEvent.pointerDown(elsewhere)
      // What the browser's mousedown does next: focus what was pressed.
      elsewhere.focus()
    })
    expect(panel()).toBeNull()
    await act(async () => {})
    expect(document.activeElement).toBe(elsewhere)
  })

  test('hidden: no button while collapsed, and focus goes back where it came from', async () => {
    render(<Harness hidden />)
    expect(screen.queryByRole('button', { name: /Search the rules/ })).toBeNull()

    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    elsewhere.focus()
    await press(elsewhere)
    expect(panel()).toBeTruthy()

    await pressEscape(query())
    expect(panel()).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(elsewhere))
  })
})
