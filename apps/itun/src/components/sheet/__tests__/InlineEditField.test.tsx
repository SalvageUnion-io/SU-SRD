/**
 * Tests for InlineEditField.
 *
 * Covers:
 * - Display mode: renders value as text, no input mounted.
 * - Click → input mounted with current value.
 * - Type + Enter → onSave called with parsed value; returns to display.
 * - Type + blur → onSave called with parsed value; returns to display.
 * - Esc → cancels; reverts to display; onSave NOT called.
 * - Invalid (out-of-range) → no save, inline error shown, stays in edit mode.
 * - readOnly → no click affordance; stays in display mode.
 *
 * Uses dep-injection (onSave as stub). No mock.module(). toBeTruthy() not toBeInTheDocument().
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { InlineEditField } from '../InlineEditField'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noopSave() {
  return Promise.resolve()
}

// ---------------------------------------------------------------------------
// Display mode
// ---------------------------------------------------------------------------

describe('InlineEditField — display mode', () => {
  test('renders value as text', () => {
    render(<InlineEditField value={42} onSave={noopSave} type="number" />)
    expect(screen.getByText('42')).toBeTruthy()
  })

  test('no input rendered in display mode', () => {
    render(<InlineEditField value={42} onSave={noopSave} type="number" />)
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  test('has role=button in display mode (clickable)', () => {
    render(<InlineEditField value={10} onSave={noopSave} type="number" />)
    expect(screen.getByRole('button')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Click → edit mode
// ---------------------------------------------------------------------------

describe('InlineEditField — click to edit', () => {
  test('click mounts input with current value', async () => {
    render(<InlineEditField value={42} onSave={noopSave} type="number" ariaLabel="Edit HP" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('spinbutton')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('42')
  })

  test('display span is no longer rendered after click', async () => {
    render(<InlineEditField value={42} onSave={noopSave} type="number" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(screen.queryByRole('button')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Enter key → save
// ---------------------------------------------------------------------------

describe('InlineEditField — Enter saves', () => {
  test('Enter calls onSave with parsed number and returns to display', async () => {
    const onSave = mock(async () => {})
    render(<InlineEditField value={10} onSave={onSave} type="number" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '20' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(onSave).toHaveBeenCalledWith(20)
    // After save, returns to display mode
    expect(screen.queryByRole('spinbutton')).toBeNull()
    // Display shows the prop value (controlled by parent)
    expect(screen.getByText('10')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Blur → save
// ---------------------------------------------------------------------------

describe('InlineEditField — blur saves', () => {
  test('blur calls onSave with parsed number', async () => {
    const onSave = mock(async () => {})
    render(<InlineEditField value={5} onSave={onSave} type="number" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '7' } })
      fireEvent.blur(input)
    })

    expect(onSave).toHaveBeenCalledWith(7)
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Esc → cancel
// ---------------------------------------------------------------------------

describe('InlineEditField — Esc cancels', () => {
  test('Esc reverts to display without calling onSave', async () => {
    const onSave = mock(async () => {})
    render(<InlineEditField value={15} onSave={onSave} type="number" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '99' } })
      fireEvent.keyDown(input, { key: 'Escape' })
    })

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    // Original value still displayed
    expect(screen.getByText('15')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Validation — out of range
// ---------------------------------------------------------------------------

describe('InlineEditField — number validation', () => {
  test('value below min shows error and stays in edit mode', async () => {
    const onSave = mock(async () => {})
    render(<InlineEditField value={5} onSave={onSave} type="number" min={0} max={10} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '-1' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(onSave).not.toHaveBeenCalled()
    // Still in edit mode
    expect(screen.getByRole('spinbutton')).toBeTruthy()
    // Error message rendered
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/minimum value is 0/i)).toBeTruthy()
  })

  test('value above max shows error and stays in edit mode', async () => {
    const onSave = mock(async () => {})
    render(<InlineEditField value={5} onSave={onSave} type="number" min={0} max={10} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '20' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/maximum value is 10/i)).toBeTruthy()
  })

  test('empty number input shows error (no save)', async () => {
    const onSave = mock(async () => {})
    render(<InlineEditField value={5} onSave={onSave} type="number" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      // Set to empty string — number inputs coerce non-numeric to '' in DOM environments
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/must be a number/i)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// readOnly mode
// ---------------------------------------------------------------------------

describe('InlineEditField — readOnly', () => {
  test('no role=button rendered when readOnly', () => {
    render(<InlineEditField value={42} onSave={noopSave} type="number" readOnly />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('click does not enter edit mode when readOnly', async () => {
    render(<InlineEditField value={42} onSave={noopSave} type="number" readOnly />)
    const span = screen.getByText('42')

    await act(async () => {
      fireEvent.click(span)
    })

    expect(screen.queryByRole('spinbutton')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Text type
// ---------------------------------------------------------------------------

describe('InlineEditField — text type', () => {
  test('renders text type input after click', async () => {
    render(<InlineEditField value="hello" onSave={noopSave} type="text" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  test('Enter saves text value as string', async () => {
    const onSave = mock(async () => {})
    render(<InlineEditField value="hello" onSave={onSave} type="text" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('textbox')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'world' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(onSave).toHaveBeenCalledWith('world')
  })
})
