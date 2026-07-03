/**
 * useSearchCombobox — shared combobox logic (audit item 11).
 * Consumer-shell behavior (dropdown vs dialog) is covered by the apps' own
 * SearchIsland/GlobalSearch tests; these pin the hook contract.
 */
import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { useSearchCombobox } from '../useSearchCombobox'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

async function typeAndSettle(
  result: { current: ReturnType<typeof useSearchCombobox> },
  value: string
) {
  act(() => {
    result.current.handleInput(value)
  })
  // Wait past the 150 ms debounce.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 180))
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
    expect(picked).toEqual([result.current.results[0]!.id])

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
