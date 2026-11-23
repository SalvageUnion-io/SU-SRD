/** r8 B10: Mediate's T, R, N and "?" keys, and the undo kept for the ⋯ (r8 B4). */
import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { dropChange, keepChange, undoLastChange } from '../oppositionUndo.model'
import { useMediatorKeys } from '../useMediatorKeys'

describe('useMediatorKeys', () => {
  test('T tells the table, "?" opens the sheet, N presses the live Next side', () => {
    const onTell = mock(() => {})
    const next = mock(() => {})
    render(
      <div>
        <div hidden>
          <button type="button" data-initiative-next="">
            Hidden next
          </button>
        </div>
        <button type="button" data-initiative-next="" onClick={next}>
          Next side
        </button>
        <input aria-label="Note" />
      </div>
    )
    const { result } = renderHook(() => useMediatorKeys(onTell))
    fireEvent.keyDown(document, { key: 't' })
    expect(onTell).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'n' })
    expect(next).toHaveBeenCalledTimes(1)
    // A modifier, Shift, an unbound key or typing in a field presses nothing.
    fireEvent.keyDown(document, { key: 't', ctrlKey: true })
    fireEvent.keyDown(document, { key: 'T', shiftKey: true })
    fireEvent.keyDown(document, { key: 'x' })
    fireEvent.keyDown(document.querySelector('input') as Element, { key: 't' })
    fireEvent.keyDown(document, { key: 'r' })
    expect(onTell).toHaveBeenCalledTimes(1)
    act(() => {
      fireEvent.keyDown(document, { key: '?' })
    })
    expect(result.current.keysOpen).toBe(true)
    act(() => result.current.closeKeys())
    expect(result.current.keysOpen).toBe(false)
  })
})

describe('the last Opposition change', () => {
  test('undoes once, and a change undone by its toast is forgotten', () => {
    const undo = mock(() => {})
    const change = { label: 'HP', undo }
    expect(undoLastChange('g1')).toBe(false)
    keepChange('g1', change)
    dropChange('g1', { label: 'other', undo })
    expect(undoLastChange('g1')).toBe(true)
    expect(undo).toHaveBeenCalledTimes(1)
    keepChange('g1', change)
    dropChange('g1', change)
    expect(undoLastChange('g1')).toBe(false)
  })
})
