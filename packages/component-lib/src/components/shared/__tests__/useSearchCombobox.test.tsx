/**
 * useSearchCombobox — shared combobox logic (audit item 11).
 * Consumer-shell behavior (dropdown vs dialog) is covered by the apps' own
 * SearchIsland/GlobalSearch tests; these pin the hook contract.
 */
import { afterEach, beforeEach, describe, expect, jest, mock, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { schemaPluralLabel } from '../../../utils/schemaLabels'
import { useSearchCombobox } from '../useSearchCombobox'

/** The hook's own `debounceMs` default (see `useSearchCombobox.ts`). */
const DEBOUNCE_MS = 150

/** Narrow a possibly-null query result, failing the test loudly if absent. */
function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected element to be present')
  return value
}

// The debounce is driven, not slept through: a fixed real-time margin over a
// real timer is a latent flake on a loaded runner and pure dead wall-clock
// everywhere else. Same approach as RollTable.test.tsx.
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

async function typeAndSettle(
  result: { current: ReturnType<typeof useSearchCombobox> },
  value: string
) {
  act(() => {
    result.current.handleInput(value)
  })
  await act(async () => {
    jest.advanceTimersByTime(DEBOUNCE_MS)
  })
}

describe('useSearchCombobox', () => {
  test('debounced input produces blended category + entity results', async () => {
    const onSubmit = mock(() => {})
    const { result } = renderHook(() => useSearchCombobox({ onSubmit }))

    await typeAndSettle(result, 'laser')

    expect(result.current.hasSearched).toBe(true)
    expect(result.current.results.length).toBeGreaterThan(0)
    expect(result.current.results.length).toBeLessThanOrEqual(10)
    expect(result.current.results.every((r) => r.kind === 'schema' || r.kind === 'entity')).toBe(
      true
    )
  })

  test('multi-token queries match ("mining laser")', async () => {
    const { result } = renderHook(() => useSearchCombobox({ onSubmit: () => {} }))
    await typeAndSettle(result, 'mining laser')
    expect(result.current.results.some((r) => r.title.toLowerCase().includes('mining'))).toBe(true)
  })

  test('category rows and entity rows spell a schema the same way', async () => {
    const { result } = renderHook(() => useSearchCombobox({ onSubmit: () => {} }))
    await typeAndSettle(result, 'bay')

    const entityRows = result.current.results.filter((r) => r.kind === 'entity')
    expect(entityRows.length).toBeGreaterThan(0)
    for (const row of entityRows) {
      // The authored plural ('Crawler Bays'), never the raw kebab-case id.
      expect(row.group).toBe(schemaPluralLabel(row.schemaId))
      expect(row.group).not.toBe(row.schemaId)
    }

    const categoryRows = result.current.results.filter((r) => r.kind === 'schema')
    for (const category of categoryRows) {
      const sameSchema = entityRows.filter((r) => r.schemaId === category.schemaId)
      for (const row of sameSchema) expect(row.group).toBe(category.title)
    }
  })

  test('ArrowDown/Enter submits the highlighted result; bare Enter submits the first', async () => {
    const picked: string[] = []
    const { result } = renderHook(() => useSearchCombobox({ onSubmit: (r) => picked.push(r.id) }))
    await typeAndSettle(result, 'laser')

    const preventDefault = () => {}
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault })
    })
    expect(result.current.selectedIndex).toBe(0)
    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault })
    })
    expect(picked).toEqual([must(result.current.results[0]).id])

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault })
    })
    expect(result.current.selectedIndex).toBe(-1)
    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault })
    })
    expect(picked).toHaveLength(2)
  })

  test('results stay hidden and announcement reads loading while not ready', async () => {
    const { result } = renderHook(() => useSearchCombobox({ ready: false, onSubmit: () => {} }))
    await typeAndSettle(result, 'laser')

    expect(result.current.results).toEqual([])
    expect(result.current.announcement).toBe('Loading game data')
  })

  test('flipping ready re-runs the pending query', async () => {
    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) => useSearchCombobox({ ready, onSubmit: () => {} }),
      { initialProps: { ready: false } }
    )
    await typeAndSettle(result, 'laser')
    expect(result.current.results).toEqual([])

    act(() => {
      rerender({ ready: true })
    })
    expect(result.current.results.length).toBeGreaterThan(0)
    expect(result.current.announcement).toMatch(/results? found/)
  })

  test('clearing the query resets state and the empty announcement', async () => {
    const { result } = renderHook(() => useSearchCombobox({ onSubmit: () => {} }))
    await typeAndSettle(result, 'laser')
    await typeAndSettle(result, '')

    expect(result.current.hasSearched).toBe(false)
    expect(result.current.results).toEqual([])
    expect(result.current.announcement).toBeNull()
  })

  test('aria wiring: activedescendant follows the highlighted option', async () => {
    const { result } = renderHook(() => useSearchCombobox({ onSubmit: () => {} }))
    await typeAndSettle(result, 'laser')

    expect(result.current.inputProps['aria-activedescendant']).toBeUndefined()
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: () => {} })
    })
    expect(result.current.inputProps['aria-activedescendant']).toBe(result.current.optionId(0))
  })
})
