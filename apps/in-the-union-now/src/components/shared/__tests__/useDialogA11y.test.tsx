/**
 * Unit tests for useDialogA11y hook.
 *
 * Covers:
 * - Initial focus is moved to the first focusable element inside the dialog.
 * - Tab key cycles forward through focusable elements (wraps last → first).
 * - Shift+Tab cycles backward (wraps first → last).
 * - Escape calls onClose.
 * - Focus is restored to the previously-focused element on unmount.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'

import { useDialogA11y } from '../useDialogA11y'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal dialog fixture: two buttons inside a div with the hook applied. */
function TwoButtonDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogA11y({ ref: dialogRef, onClose })
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="test-title">
      <h2 id="test-title">Test Dialog</h2>
      <button type="button">First</button>
      <button type="button">Second</button>
    </div>
  )
}

/** Dialog with a single focusable element. */
function SingleButtonDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogA11y({ ref: dialogRef, onClose })
  return (
    <div ref={dialogRef} role="dialog">
      <button type="button">Only button</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Initial focus
// ---------------------------------------------------------------------------

describe('useDialogA11y — initial focus', () => {
  test('moves focus to the first focusable element on mount', async () => {
    await act(async () => {
      render(<TwoButtonDialog onClose={() => {}} />)
    })

    const firstButton = screen.getByText('First')
    expect(document.activeElement).toBe(firstButton)
  })
})

// ---------------------------------------------------------------------------
// Escape to close
// ---------------------------------------------------------------------------

describe('useDialogA11y — Escape key', () => {
  test('calls onClose when Escape is pressed', async () => {
    const onClose = mock(() => {})

    await act(async () => {
      render(<TwoButtonDialog onClose={onClose} />)
    })

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('does not call onClose for other keys', async () => {
    const onClose = mock(() => {})

    await act(async () => {
      render(<TwoButtonDialog onClose={onClose} />)
    })

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Enter' })
    })

    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tab cycling (focus trap)
// ---------------------------------------------------------------------------

describe('useDialogA11y — Tab key cycling', () => {
  test('Tab on the last focusable element wraps focus to first', async () => {
    await act(async () => {
      render(<TwoButtonDialog onClose={() => {}} />)
    })

    const firstButton = screen.getByText('First')
    const secondButton = screen.getByText('Second')

    // Move focus to last button
    await act(async () => {
      secondButton.focus()
    })

    expect(document.activeElement).toBe(secondButton)

    // Tab from last → wraps to first
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
    })

    expect(document.activeElement).toBe(firstButton)
  })

  test('Shift+Tab on the first focusable element wraps focus to last', async () => {
    await act(async () => {
      render(<TwoButtonDialog onClose={() => {}} />)
    })

    const firstButton = screen.getByText('First')
    const secondButton = screen.getByText('Second')

    // Focus first button explicitly
    await act(async () => {
      firstButton.focus()
    })

    expect(document.activeElement).toBe(firstButton)

    // Shift+Tab from first → wraps to last
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    })

    expect(document.activeElement).toBe(secondButton)
  })

  test('Escape still works after Tab cycling', async () => {
    const onClose = mock(() => {})

    await act(async () => {
      render(<TwoButtonDialog onClose={onClose} />)
    })

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Focus restoration on unmount
// ---------------------------------------------------------------------------

describe('useDialogA11y — focus restoration', () => {
  test('restores focus to the trigger element when the dialog unmounts', async () => {
    // Create a trigger button in the document and focus it before opening dialog.
    const trigger = document.createElement('button')
    trigger.textContent = 'Open dialog'
    document.body.appendChild(trigger)
    trigger.focus()

    expect(document.activeElement).toBe(trigger)

    let unmount: (() => void) | undefined

    await act(async () => {
      const result = render(<SingleButtonDialog onClose={() => {}} />)
      unmount = result.unmount
    })

    // Focus should now be inside dialog
    const onlyButton = screen.getByText('Only button')
    expect(document.activeElement).toBe(onlyButton)

    // Unmount the dialog
    await act(async () => {
      unmount!()
    })

    // Focus should return to trigger
    expect(document.activeElement).toBe(trigger)

    document.body.removeChild(trigger)
  })
})
