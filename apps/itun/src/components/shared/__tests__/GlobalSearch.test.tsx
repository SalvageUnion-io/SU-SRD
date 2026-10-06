/**
 * GlobalSearch tests — ITUN's reference search, behind the bottom-right FAB
 * (report item P-2).
 *
 * Runs against the real salvageunion-reference dataset (preloaded via
 * bunfig.toml, same as every other workspace) so search behaviour stays
 * honest — "iron wyrm" is a known-stable chassis name in the dataset.
 *
 * What these pin: the FAB opens and closes the panel (button, Cmd/Ctrl+K,
 * Escape, an outside press) with focus going where a keyboard user expects;
 * results render ABOVE the input with the best match nearest it, and the
 * arrow keys follow that screen order; an entity opens the detail modal and a
 * category opens the SRD in a new tab. Structure is asserted through DOM
 * order and ARIA, never pixels.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injection over
 * mock.module(); the debounce is driven with fake timers inside act() rather
 * than slept through, so state lands cleanly and no real time is burned.
 */

import { describe, expect, jest, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { must } from '../../__tests__/must'
import { GlobalSearch } from '../GlobalSearch'

/** `useSearchCombobox`'s own `debounceMs` default. */
const DEBOUNCE_MS = 150

const fab = () => screen.getByRole('button', { name: 'Search the rules' })
const closeButton = () => screen.getByRole('button', { name: 'Close: Search the rules' })
const panel = () => screen.queryByRole('dialog', { name: 'Search the rules' })
const input = () => screen.getByRole('combobox', { name: 'Search the rules' })

function openWithFab() {
  fireEvent.click(fab())
  return must(panel())
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

describe('the FAB', () => {
  test('is a collapsed button that opens the search panel and focuses its input', () => {
    render(<GlobalSearch />)
    expect(fab().getAttribute('aria-expanded')).toBe('false')
    expect(panel()).toBeFalsy()

    const opened = openWithFab()
    expect(closeButton().getAttribute('aria-expanded')).toBe('true')
    expect(closeButton().getAttribute('aria-controls')).toBe(opened.id)
    expect(document.activeElement).toBe(input())
  })

  test('pressing it again collapses the panel, focus staying on the button', () => {
    render(<GlobalSearch />)
    openWithFab()
    fireEvent.click(closeButton())
    expect(panel()).toBeFalsy()
    expect(document.activeElement).toBe(fab())
  })

  test('Escape collapses it and returns focus to the button', () => {
    render(<GlobalSearch />)
    openWithFab()
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(panel()).toBeFalsy()
    expect(document.activeElement).toBe(fab())
  })

  test('a press outside collapses it, and focus lands back on the button', async () => {
    render(<GlobalSearch />)
    openWithFab()
    fireEvent.pointerDown(document.body)
    expect(panel()).toBeFalsy()
    await waitFor(() => expect(document.activeElement).toBe(fab()))
  })

  test('a press inside the panel does not collapse it', () => {
    render(<GlobalSearch />)
    openWithFab()
    fireEvent.pointerDown(input())
    expect(panel()).toBeTruthy()
  })

  test('Cmd+K opens and focuses the search; Ctrl+K again closes it', () => {
    render(<GlobalSearch />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(panel()).toBeTruthy()
    expect(document.activeElement).toBe(input())

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(panel()).toBeFalsy()
    expect(document.activeElement).toBe(fab())
  })

  test('plain "k" does not toggle it', () => {
    render(<GlobalSearch />)
    fireEvent.keyDown(document, { key: 'k' })
    expect(panel()).toBeFalsy()
  })

  test('advertises the shortcut it answers to', () => {
    render(<GlobalSearch />)
    expect(fab().getAttribute('aria-keyshortcuts')).toBe('Meta+K Control+K')
  })

  test('where the corner is taken it hides, and Cmd+K still opens the search', () => {
    render(<GlobalSearch fabHidden />)
    expect(screen.queryByRole('button', { name: 'Search the rules' })).toBeFalsy()

    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(panel()).toBeTruthy()
    expect(document.activeElement).toBe(input())
  })
})

describe('the results', () => {
  test('render above the input, best match nearest it', async () => {
    render(<GlobalSearch />)
    openWithFab()
    const field = await typeQuery('chassis')

    const listbox = screen.getByRole('listbox', { name: 'Search results' })
    // The list comes BEFORE the input in the panel: it grows upward from it.
    expect(listbox.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const options = within(listbox).getAllByRole('option')
    expect(options.length).toBeGreaterThan(1)
    // Category rows rank first ("chassis" is a schema), so the LAST row — the
    // one directly above the input — is a category, and the first is not.
    expect(options.at(-1)?.textContent).toContain('Category')
    expect(options[0]?.textContent).not.toContain('Category')
  })

  test('the arrow keys follow the screen: ↑ leaves the input, ↓ comes back', async () => {
    render(<GlobalSearch />)
    openWithFab()
    const field = await typeQuery('chassis')
    const options = screen.getAllByRole('option')
    const nearest = must(options.at(-1))
    const next = must(options.at(-2))

    fireEvent.keyDown(field, { key: 'ArrowUp' })
    expect(nearest.getAttribute('aria-selected')).toBe('true')
    expect(field.getAttribute('aria-activedescendant')).toBe(nearest.id)

    fireEvent.keyDown(field, { key: 'ArrowUp' })
    expect(next.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    expect(field.getAttribute('aria-activedescendant')).toBeNull()
  })

  test('a no-hit query shows the empty state', async () => {
    render(<GlobalSearch />)
    openWithFab()
    await typeQuery('zzzz-no-such-entity')
    // Rendered twice: the visible empty state + the sr-only live region.
    expect(screen.getAllByText('No results found').length).toBeGreaterThan(0)
    expect(screen.queryByRole('listbox')).toBeFalsy()
  })

  test('Enter opens the entity detail modal and collapses the panel', async () => {
    render(<GlobalSearch />)
    openWithFab()
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
      render(<GlobalSearch />)
      openWithFab()
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
