/**
 * GlobalSearch tests — ITUN's reference search, a trigger in the Union bar
 * ("Search · ⌘K") that opens a panel under it.
 *
 * Runs against the real salvageunion-reference dataset (preloaded via
 * bunfig.toml, same as every other workspace) so search behaviour stays
 * honest — "iron wyrm" is a known-stable chassis name in the dataset.
 *
 * What these pin: the trigger opens and closes the panel (button, Cmd/Ctrl+K,
 * Escape, an outside press) with focus going where a keyboard user expects;
 * results render BELOW the input, best match first, and the arrow keys follow
 * that order; an entity opens the detail modal and a
 * category opens the SRD in a new tab. Structure is asserted through DOM
 * order and ARIA, never pixels.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injection over
 * mock.module(); the debounce is driven with fake timers inside act() rather
 * than slept through, so state lands cleanly and no real time is burned.
 */

import { describe, expect, jest, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { must } from '../../__tests__/must'
import { GlobalSearch } from '../GlobalSearch'

/** The root's shape: one open state, handed to the trigger. */
function Harness({ variant = 'bar' }: { variant?: 'bar' | 'icon' }) {
  const [open, setOpen] = useState(false)
  return <GlobalSearch variant={variant} open={open} onOpenChange={setOpen} />
}

/** `useSearchCombobox`'s own `debounceMs` default. */
const DEBOUNCE_MS = 150

const trigger = () => screen.getByRole('button', { name: 'Search the rules' })
const panel = () => screen.queryByRole('dialog', { name: 'Search the rules' })
const input = () => screen.getByRole('combobox', { name: 'Search the rules' })

async function openWithTrigger() {
  await act(async () => {
    fireEvent.click(trigger())
  })
  return must(panel())
}

/** Fire `fire` and let Base UI's focus moves (a microtask, a frame) land. */
async function settle(fire: () => void) {
  await act(async () => {
    fire()
  })
}

/**
 * Type a query and drive the debounce out inside act().
 *
 * Fake timers are scoped to this helper rather than the whole file on purpose:
 * RTL's `waitFor` polls on a real interval, so leaving timers faked for a test
 * that calls it hangs the suite.
 */
async function typeQuery(value: string) {
  const field = input()
  jest.useFakeTimers()
  try {
    fireEvent.change(field, { target: { value } })
    await act(async () => {
      jest.advanceTimersByTime(DEBOUNCE_MS)
    })
  } finally {
    jest.useRealTimers()
  }
  return field
}

describe('the trigger', () => {
  test('is a collapsed button that opens the search panel and focuses its input', async () => {
    render(<Harness />)
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(panel()).toBeFalsy()

    const opened = await openWithTrigger()
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(trigger().getAttribute('aria-controls')).toBe(opened.id)
    await waitFor(() => expect(document.activeElement).toBe(input()))
  })

  test('reopening keeps the last query, selected so typing replaces it', async () => {
    render(<Harness />)
    await openWithTrigger()
    await typeQuery('iron wyrm')
    await settle(() => fireEvent.click(trigger()))

    await openWithTrigger()
    const field = input() as HTMLInputElement
    expect(field.value).toBe('iron wyrm')
    await waitFor(() => expect(document.activeElement).toBe(field))
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe('iron wyrm'.length)
  })

  test('pressing it again collapses the panel, focus staying on the button', async () => {
    render(<Harness />)
    await openWithTrigger()
    await settle(() => fireEvent.click(trigger()))
    expect(panel()).toBeFalsy()
    await waitFor(() => expect(document.activeElement).toBe(trigger()))
  })

  test('Escape collapses it and returns focus to the button', async () => {
    render(<Harness />)
    await openWithTrigger()
    await settle(() => fireEvent.keyDown(input(), { key: 'Escape' }))
    expect(panel()).toBeFalsy()
    await waitFor(() => expect(document.activeElement).toBe(trigger()))
  })

  test('a press outside collapses it', async () => {
    render(<Harness />)
    await openWithTrigger()
    await settle(() => {
      fireEvent.pointerDown(document.body)
      fireEvent.click(document.body)
    })
    expect(panel()).toBeFalsy()
  })

  test('a press inside the panel does not collapse it', async () => {
    render(<Harness />)
    await openWithTrigger()
    await settle(() => {
      fireEvent.pointerDown(input())
      fireEvent.click(input())
    })
    expect(panel()).toBeTruthy()
  })

  test('Cmd+K opens and focuses the search; Ctrl+K again closes it', async () => {
    render(<Harness />)
    await settle(() => fireEvent.keyDown(document, { key: 'k', metaKey: true }))
    expect(panel()).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(input()))

    await settle(() => fireEvent.keyDown(document, { key: 'k', ctrlKey: true }))
    expect(panel()).toBeFalsy()
    await waitFor(() => expect(document.activeElement).toBe(trigger()))
  })

  test('plain "k" does not toggle it', () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'k' })
    expect(panel()).toBeFalsy()
  })

  test('advertises the shortcut it answers to', () => {
    render(<Harness />)
    expect(trigger().getAttribute('aria-keyshortcuts')).toBe('Meta+K Control+K')
  })
})

describe('the phone trigger', () => {
  /** A viewport narrower than `lg`: the desktop query does not match. */
  function onPhone() {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia
    return () => {
      window.matchMedia = original
    }
  }

  test('the icon button opens the panel; the bar trigger, hidden at this width, does not', async () => {
    const restore = onPhone()
    try {
      const { unmount } = render(<Harness variant="icon" />)
      expect(trigger().getAttribute('aria-keyshortcuts')).toBeNull()
      await openWithTrigger()
      expect(panel()).toBeTruthy()
      unmount()

      render(<Harness variant="bar" />)
      await settle(() => fireEvent.click(trigger()))
      expect(panel()).toBeFalsy()
    } finally {
      restore()
    }
  })
})

describe('the results', () => {
  test('render below the input, best match first', async () => {
    render(<Harness />)
    await openWithTrigger()
    const field = await typeQuery('chassis')

    const listbox = screen.getByRole('listbox', { name: 'Search results' })
    // The list comes AFTER the input in the panel.
    expect(listbox.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()

    const options = within(listbox).getAllByRole('option')
    expect(options.length).toBeGreaterThan(1)
    // Category rows rank first ("chassis" is a schema), so the FIRST row —
    // the one directly under the input — is a category.
    expect(options[0]?.textContent).toContain('Category')
  })

  test('the arrow keys follow the screen: ↓ leaves the input, ↑ comes back', async () => {
    render(<Harness />)
    await openWithTrigger()
    const field = await typeQuery('chassis')
    const options = screen.getAllByRole('option')
    const nearest = must(options[0])
    const next = must(options[1])

    fireEvent.keyDown(field, { key: 'ArrowDown' })
    expect(nearest.getAttribute('aria-selected')).toBe('true')
    expect(field.getAttribute('aria-activedescendant')).toBe(nearest.id)

    fireEvent.keyDown(field, { key: 'ArrowDown' })
    expect(next.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(field, { key: 'ArrowUp' })
    fireEvent.keyDown(field, { key: 'ArrowUp' })
    expect(field.getAttribute('aria-activedescendant')).toBeNull()
  })

  test('a no-hit query shows the empty state', async () => {
    render(<Harness />)
    await openWithTrigger()
    await typeQuery('zzzz-no-such-entity')
    // Rendered twice: the visible empty state + the sr-only live region.
    expect(screen.getAllByText('No results found').length).toBeGreaterThan(0)
    expect(screen.queryByRole('listbox')).toBeFalsy()
  })

  test('Enter opens the entity detail modal and collapses the panel', async () => {
    render(<Harness />)
    await openWithTrigger()
    const field = await typeQuery('iron wyrm')

    // The best match is the Iron Wyrm chassis (no schema matches "iron wyrm").
    fireEvent.keyDown(field, { key: 'Enter' })

    expect(panel()).toBeFalsy()
    await waitFor(() => {
      expect(screen.getAllByText('Iron Wyrm').length).toBeGreaterThan(0)
    })
  })

  test('picking a category row opens the SRD schema page in a new tab', async () => {
    const openSpy = mock(() => null)
    const originalOpen = window.open
    window.open = openSpy
    try {
      render(<Harness />)
      await openWithTrigger()
      await typeQuery('chassis')

      const categoryOption = screen
        .getAllByRole('option')
        .find((option) => option.textContent?.includes('Category'))
      fireEvent.click(must(categoryOption))

      expect(openSpy).toHaveBeenCalledWith(
        'https://salvageunion.io/schema/chassis',
        '_blank',
        'noopener,noreferrer'
      )
      // Category rows leave the panel open (an outbound side-trip).
      expect(panel()).toBeTruthy()
    } finally {
      window.open = originalOpen
    }
  })
})
