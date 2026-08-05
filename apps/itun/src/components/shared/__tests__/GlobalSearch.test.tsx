/**
 * GlobalSearch tests (reference search, report item P-2).
 *
 * Runs against the real salvageunion-reference dataset (preloaded via
 * bunfig.toml, same as every other workspace) so search behaviour stays
 * honest — "iron wyrm" is a known-stable chassis name in the dataset.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injection over
 * mock.module(); the debounce is driven with fake timers inside act() rather
 * than slept through, so state lands cleanly and no real time is burned.
 */

import { describe, expect, jest, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { must } from '../../__tests__/must'
import { GlobalSearch } from '../GlobalSearch'

/** `useSearchCombobox`'s own `debounceMs` default. */
const DEBOUNCE_MS = 150

/** Stateful harness so onOpenChange actually closes/opens the dialog. */
// biome-ignore lint/style/useComponentExportOnlyModules: test-local harness component; Fast Refresh does not apply to test files
function Harness({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  return <GlobalSearch open={open} onOpenChange={setOpen} />
}

/**
 * Type a query and drive the debounce out inside act().
 *
 * Fake timers are scoped to this helper rather than the whole file on purpose:
 * RTL's `waitFor` polls on a real interval, so leaving timers faked for a test
 * that calls it hangs the suite.
 */
async function typeQuery(value: string) {
  const input = screen.getByRole('combobox', { name: 'Search the SRD' })
  jest.useFakeTimers()
  try {
    fireEvent.change(input, { target: { value } })
    await act(async () => {
      jest.advanceTimersByTime(DEBOUNCE_MS)
    })
  } finally {
    jest.useRealTimers()
  }
  return input
}

describe('GlobalSearch', () => {
  test('Cmd+K opens the dialog; Cmd+K again closes it', () => {
    const onOpenChange = mock(() => {})
    render(<GlobalSearch open={false} onOpenChange={onOpenChange} />)

    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(onOpenChange).toHaveBeenCalledWith(true)

    cleanup()
    const onOpenChange2 = mock(() => {})
    render(<GlobalSearch open={true} onOpenChange={onOpenChange2} />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(onOpenChange2).toHaveBeenCalledWith(false)
  })

  test('plain "k" does not toggle the dialog', () => {
    const onOpenChange = mock(() => {})
    render(<GlobalSearch open={false} onOpenChange={onOpenChange} />)
    fireEvent.keyDown(document, { key: 'k' })
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  test('typing a query lists grouped category and entity results', async () => {
    render(<Harness />)
    await typeQuery('chassis')

    const listbox = screen.getByRole('listbox', { name: 'Search results' })
    expect(listbox).toBeTruthy()

    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
    // Category rows lead (schema match on "chassis"), entity hits follow.
    expect(options[0]?.textContent).toContain('Category')
  })

  test('shows the empty state for a no-hit query', async () => {
    render(<Harness />)
    await typeQuery('zzzz-no-such-entity')
    // Rendered twice: the visible empty state + the sr-only live region.
    expect(screen.getAllByText('No results found').length).toBeGreaterThan(0)
    expect(screen.queryByRole('listbox')).toBeFalsy()
  })

  test('Enter opens the entity detail modal and closes the search dialog', async () => {
    render(<Harness />)
    const input = await typeQuery('iron wyrm')

    // First result is the Iron Wyrm chassis (no schema matches "iron wyrm").
    fireEvent.keyDown(input, { key: 'Enter' })

    // Search dialog closed…
    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: 'Search the SRD' })).toBeFalsy()
    })
    // …and the canonical detail modal renders the entity.
    await waitFor(() => {
      expect(screen.getAllByText('Iron Wyrm').length).toBeGreaterThan(0)
    })
  })

  test('arrow keys move the active option', async () => {
    render(<Harness />)
    const input = await typeQuery('chassis')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })

    const options = screen.getAllByRole('option')
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id ?? '')
  })

  test('picking a category row opens the SRD schema page in a new tab', async () => {
    const openSpy = mock(() => null)
    const originalOpen = window.open
    window.open = openSpy
    try {
      render(<Harness />)
      await typeQuery('chassis')

      const categoryOption = screen
        .getAllByRole('option')
        .find((option) => option.textContent?.includes('Category'))
      expect(categoryOption).toBeTruthy()
      fireEvent.click(must(categoryOption))

      expect(openSpy).toHaveBeenCalledWith(
        'https://salvageunion.io/schema/chassis',
        '_blank',
        'noopener,noreferrer'
      )
      // Category rows leave the search dialog open (outbound side-trip).
      expect(screen.getByRole('combobox', { name: 'Search the SRD' })).toBeTruthy()
    } finally {
      window.open = originalOpen
    }
  })
})
