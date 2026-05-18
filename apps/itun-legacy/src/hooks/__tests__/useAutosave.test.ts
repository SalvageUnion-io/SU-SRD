import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useAutosave } from '../useAutosave'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('useAutosave', () => {
  beforeEach(() => {
    mock.restore()
  })

  test('does not fire on initial render', async () => {
    const onSave = mock(() => {})
    renderHook(() => useAutosave({ value: { name: 'test' }, onSave, delay: 50 }))

    await wait(100)
    expect(onSave).not.toHaveBeenCalled()
  })

  test('fires onSave after debounce delay when value changes', async () => {
    const onSave = mock(() => {})
    const { rerender } = renderHook(({ value }) => useAutosave({ value, onSave, delay: 50 }), {
      initialProps: { value: { name: 'a' } },
    })

    rerender({ value: { name: 'b' } })
    // Not yet fired
    expect(onSave).not.toHaveBeenCalled()

    await wait(80)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ name: 'b' })
  })

  test('restarts debounce timer on rapid changes', async () => {
    const onSave = mock(() => {})
    const { rerender } = renderHook(({ value }) => useAutosave({ value, onSave, delay: 100 }), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    await wait(50)
    rerender({ value: 'c' })
    await wait(50)
    // Only 50ms since last change, should not have fired yet
    expect(onSave).not.toHaveBeenCalled()

    await wait(80)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('c')
  })

  test('skips no-op when value changes back to last saved', async () => {
    const onSave = mock(() => {})
    const { rerender } = renderHook(({ value }) => useAutosave({ value, onSave, delay: 50 }), {
      initialProps: { value: 'a' },
    })

    // Change and let it save
    rerender({ value: 'b' })
    await wait(80)
    expect(onSave).toHaveBeenCalledTimes(1)

    // Change back to saved value — should not fire again
    rerender({ value: 'c' })
    rerender({ value: 'b' }) // back to last saved
    await wait(80)
    expect(onSave).toHaveBeenCalledTimes(1) // still 1
  })

  test('does not fire when enabled is false', async () => {
    const onSave = mock(() => {})
    const { rerender } = renderHook(
      ({ value, enabled }) => useAutosave({ value, onSave, delay: 50, enabled }),
      { initialProps: { value: 'a', enabled: false } }
    )

    rerender({ value: 'b', enabled: false })
    await wait(80)
    expect(onSave).not.toHaveBeenCalled()
  })

  test('resumes saving when re-enabled', async () => {
    const onSave = mock(() => {})
    const { rerender } = renderHook(
      ({ value, enabled }) => useAutosave({ value, onSave, delay: 50, enabled }),
      { initialProps: { value: 'a', enabled: false } }
    )

    rerender({ value: 'b', enabled: false })
    await wait(80)
    expect(onSave).not.toHaveBeenCalled()

    // Re-enable with the changed value
    rerender({ value: 'b', enabled: true })
    await wait(80)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('b')
  })

  test('flushes pending save on unmount', async () => {
    const onSave = mock(() => {})
    const { rerender, unmount } = renderHook(
      ({ value }) => useAutosave({ value, onSave, delay: 5000 }),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'b' })
    // Timer is running but hasn't fired
    expect(onSave).not.toHaveBeenCalled()

    unmount()
    // Should have flushed
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('b')
  })

  test('flush() can be called manually', async () => {
    const onSave = mock(() => {})
    const { result, rerender } = renderHook(
      ({ value }) => useAutosave({ value, onSave, delay: 5000 }),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'b' })
    expect(onSave).not.toHaveBeenCalled()

    act(() => {
      result.current.flush()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('b')
  })

  test('does not double-fire after manual flush + timer', async () => {
    const onSave = mock(() => {})
    const { result, rerender } = renderHook(
      ({ value }) => useAutosave({ value, onSave, delay: 50 }),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'b' })
    act(() => {
      result.current.flush()
    })
    expect(onSave).toHaveBeenCalledTimes(1)

    await wait(80)
    // Timer should have been cleared by flush, no double-fire
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
