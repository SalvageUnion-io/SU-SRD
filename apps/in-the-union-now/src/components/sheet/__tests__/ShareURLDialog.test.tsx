/**
 * Tests for ShareURLDialog.
 *
 * Dep-injection pattern (no mock.module()):
 *   - `clipboardWriter` replaces navigator.clipboard.writeText
 *   - `onCopied` is a spy injected for the "copied" callback
 *
 * Conventions:
 *   - toBeTruthy() / toBeFalsy() — not toBeInTheDocument()
 *   - No mock.module()
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ShareURLDialog } from '../ShareURLDialog'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('ShareURLDialog — rendering', () => {
  test('renders with the provided URL', () => {
    render(
      <ShareURLDialog
        url="https://example.com/s/abc123"
        onClose={() => {}}
        clipboardWriter={async () => {}}
      />
    )

    const urlEl = screen.getByLabelText('Share URL')
    expect(urlEl).toBeTruthy()
    expect((urlEl as HTMLElement).textContent).toContain('abc123')
  })

  test('renders Copy button', () => {
    render(
      <ShareURLDialog
        url="https://example.com/s/abc123"
        onClose={() => {}}
        clipboardWriter={async () => {}}
      />
    )

    expect(screen.getByRole('button', { name: /copy share url/i })).toBeTruthy()
  })

  test('renders Close button', () => {
    render(
      <ShareURLDialog
        url="https://example.com/s/abc123"
        onClose={() => {}}
        clipboardWriter={async () => {}}
      />
    )

    expect(screen.getByRole('button', { name: /close/i })).toBeTruthy()
  })

  test('dialog has role="dialog" and aria-modal', () => {
    render(
      <ShareURLDialog
        url="https://example.com/s/abc123"
        onClose={() => {}}
        clipboardWriter={async () => {}}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect((dialog as HTMLElement).getAttribute('aria-modal')).toBe('true')
  })
})

// ---------------------------------------------------------------------------
// Copy interaction
// ---------------------------------------------------------------------------

describe('ShareURLDialog — copy', () => {
  test('calls clipboardWriter with the URL when Copy is clicked', async () => {
    const clipboardWriter = mock(async () => {})
    const url = 'https://example.com/s/abc123'

    render(<ShareURLDialog url={url} onClose={() => {}} clipboardWriter={clipboardWriter} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy share url/i }))
    })

    expect(clipboardWriter).toHaveBeenCalledTimes(1)
    expect(clipboardWriter).toHaveBeenCalledWith(url)
  })

  test('shows "Copied!" label after successful copy', async () => {
    const clipboardWriter = mock(async () => {})

    render(
      <ShareURLDialog
        url="https://example.com/s/abc123"
        onClose={() => {}}
        clipboardWriter={clipboardWriter}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy share url/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy share url/i }).textContent).toContain(
        'Copied!'
      )
    })
  })

  test('invokes onCopied callback after successful copy', async () => {
    const clipboardWriter = mock(async () => {})
    const onCopied = mock(() => {})

    render(
      <ShareURLDialog
        url="https://example.com/s/abc123"
        onClose={() => {}}
        clipboardWriter={clipboardWriter}
        onCopied={onCopied}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy share url/i }))
    })

    await waitFor(() => {
      expect(onCopied).toHaveBeenCalledTimes(1)
    })
  })

  test('shows error message when clipboardWriter throws', async () => {
    const clipboardWriter = mock(async () => {
      throw new Error('Permission denied')
    })

    render(
      <ShareURLDialog
        url="https://example.com/s/abc123"
        onClose={() => {}}
        clipboardWriter={clipboardWriter}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy share url/i }))
    })

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect((alert as HTMLElement).textContent).toContain('Failed to copy')
    })
  })
})

// ---------------------------------------------------------------------------
// Dismiss
// ---------------------------------------------------------------------------

describe('ShareURLDialog — dismiss', () => {
  test('calls onClose when Close button clicked', async () => {
    const onClose = mock(() => {})

    render(
      <ShareURLDialog
        url="https://example.com/s/abc123"
        onClose={onClose}
        clipboardWriter={async () => {}}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /close/i }))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('calls onClose when Escape is pressed on the backdrop', async () => {
    const onClose = mock(() => {})

    render(
      <ShareURLDialog
        url="https://example.com/s/abc123"
        onClose={onClose}
        clipboardWriter={async () => {}}
      />
    )

    // The backdrop is the first fixed div — fire keyDown on the dialog container
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement

    await act(async () => {
      fireEvent.keyDown(backdrop, { key: 'Escape' })
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
