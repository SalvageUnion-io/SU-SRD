import { describe, expect, jest, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { Fab } from '../Fab'

/**
 * Fab's contract is its ARIA, its dismissal and where it leaves focus — the
 * parts a caller would otherwise re-implement per corner control. Content is
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

describe('Fab', () => {
  test('a collapsed button: expanded state, and no panel mounted', () => {
    render(<Harness />)
    expect(button().getAttribute('aria-expanded')).toBe('false')
    expect(button().getAttribute('aria-controls')).toBeNull()
    expect(panel()).toBeNull()
  })

  test('opening mounts a named, non-modal dialog the button controls, focused inside', () => {
    render(<Harness />)
    fireEvent.click(button())

    const dialog = panel()
    expect(dialog).toBeTruthy()
    expect(dialog?.getAttribute('aria-modal')).toBeNull()
    expect(button().getAttribute('aria-expanded')).toBe('true')
    expect(button().getAttribute('aria-controls')).toBe(dialog?.id ?? '')
    // While open the button is the panel's close, and says so.
    expect(button().getAttribute('aria-label')).toBe('Close: Search the rules')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Query' }))
  })

  test('Escape inside the panel closes it, focus back on the button', () => {
    render(<Harness />)
    fireEvent.click(button())
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Query' }), { key: 'Escape' })
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(button())
  })

  test('an outside press closes it; one inside does not', () => {
    render(<Harness />)
    fireEvent.click(button())
    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Query' }))
    expect(panel()).toBeTruthy()

    // The focus reclaim is a 0ms timer. Drive it with fake timers rather than
    // poll for it: under coverage a real-timer `waitFor` can outlast the test.
    jest.useFakeTimers()
    try {
      fireEvent.pointerDown(document.body)
      expect(panel()).toBeNull()
      act(() => {
        jest.runAllTimers()
      })
    } finally {
      jest.useRealTimers()
    }
    expect(document.activeElement).toBe(button())
  })

  test('an outside press that lands on a focusable control keeps that focus', () => {
    render(<Harness />)
    fireEvent.click(button())
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    // The reclaim check is a 0ms timer; fake it so the test can run it to
    // completion rather than sleep past it.
    jest.useFakeTimers()
    try {
      fireEvent.pointerDown(elsewhere)
      // What the browser's mousedown does next: focus what was pressed.
      elsewhere.focus()
      expect(panel()).toBeNull()
      act(() => {
        jest.runAllTimers()
      })
    } finally {
      jest.useRealTimers()
    }
    expect(document.activeElement).toBe(elsewhere)
  })

  test('hidden: no button while collapsed, and focus goes back where it came from', () => {
    render(<Harness hidden />)
    expect(screen.queryByRole('button', { name: /Search the rules/ })).toBeNull()

    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    elsewhere.focus()
    fireEvent.click(elsewhere)
    expect(panel()).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Query' }), { key: 'Escape' })
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(elsewhere)
  })
})
