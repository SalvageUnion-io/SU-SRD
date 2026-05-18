import { describe, test, expect } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { useSaveStatus } from '../useSaveStatus'

describe('useSaveStatus', () => {
  test('returns empty statusText when never saved', () => {
    const { result } = renderHook(() => useSaveStatus({ isSaving: false }))
    expect(result.current.statusText).toBe('')
    expect(result.current.lastSavedAt).toBeNull()
    expect(result.current.isSaving).toBe(false)
  })

  test('returns "Saving..." while isSaving is true', () => {
    const { result } = renderHook(() => useSaveStatus({ isSaving: true }))
    expect(result.current.statusText).toBe('Saving...')
    expect(result.current.isSaving).toBe(true)
  })

  test('records lastSavedAt on isSaving true -> false transition', () => {
    const { result, rerender } = renderHook(({ isSaving }) => useSaveStatus({ isSaving }), {
      initialProps: { isSaving: true },
    })

    expect(result.current.statusText).toBe('Saving...')

    const beforeTransition = Date.now()
    rerender({ isSaving: false })
    const afterTransition = Date.now()

    expect(result.current.lastSavedAt).not.toBeNull()
    expect(result.current.lastSavedAt!.getTime()).toBeGreaterThanOrEqual(beforeTransition)
    expect(result.current.lastSavedAt!.getTime()).toBeLessThanOrEqual(afterTransition)
    expect(result.current.statusText).toBe('Saved just now')
  })

  test('does not record lastSavedAt on mount with isSaving=false', () => {
    const { result } = renderHook(() => useSaveStatus({ isSaving: false }))
    expect(result.current.lastSavedAt).toBeNull()
  })

  test('shows "Saving..." during subsequent saves after a saved state', () => {
    const { result, rerender } = renderHook(({ isSaving }) => useSaveStatus({ isSaving }), {
      initialProps: { isSaving: true },
    })

    // First save completes
    rerender({ isSaving: false })
    expect(result.current.statusText).toBe('Saved just now')

    // Second save starts
    rerender({ isSaving: true })
    expect(result.current.statusText).toBe('Saving...')

    // Second save completes
    rerender({ isSaving: false })
    expect(result.current.statusText).toBe('Saved just now')
  })

  test('returns isSaving passthrough', () => {
    const { result, rerender } = renderHook(({ isSaving }) => useSaveStatus({ isSaving }), {
      initialProps: { isSaving: false },
    })
    expect(result.current.isSaving).toBe(false)

    rerender({ isSaving: true })
    expect(result.current.isSaving).toBe(true)
  })
})
