import { useEffect, useRef, useCallback } from 'react'

type UseAutosaveOptions<T> = {
  value: T
  onSave: (value: T) => void
  delay?: number
  enabled?: boolean
}

/**
 * Generic debounced autosave hook.
 * Watches `value` via JSON.stringify comparison, debounces changes,
 * and calls `onSave` when the timer fires. Flushes on unmount.
 * Skips the initial value (doesn't fire on mount).
 */
export function useAutosave<T>({
  value,
  onSave,
  delay = 1000,
  enabled = true,
}: UseAutosaveOptions<T>) {
  const serialized = JSON.stringify(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>(serialized)
  const isFirstRender = useRef(true)
  const onSaveRef = useRef(onSave)
  const valueRef = useRef(value)
  const enabledRef = useRef(enabled)

  // Keep refs in sync (must be in useEffect per React rules)
  useEffect(() => {
    onSaveRef.current = onSave
    valueRef.current = value
    enabledRef.current = enabled
  })

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const flush = useCallback(() => {
    clearTimer()
    const currentSerialized = JSON.stringify(valueRef.current)
    if (currentSerialized !== lastSavedRef.current && enabledRef.current) {
      lastSavedRef.current = currentSerialized
      onSaveRef.current(valueRef.current)
    }
  }, [])

  useEffect(() => {
    // Skip initial render
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (!enabled) {
      clearTimer()
      return
    }

    // Skip no-op saves (value changed back to last saved)
    if (serialized === lastSavedRef.current) {
      clearTimer()
      return
    }

    // Restart debounce timer
    clearTimer()

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      lastSavedRef.current = serialized
      onSaveRef.current(valueRef.current)
    }, delay)
  }, [serialized, enabled, delay])

  // Flush on unmount
  useEffect(() => {
    return () => {
      flush()
    }
  }, [flush])

  return { flush }
}
