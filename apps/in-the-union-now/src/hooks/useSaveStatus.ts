import { useState, useEffect } from 'react'

export type SaveStatus = {
  statusText: string
  isSaving: boolean
  lastSavedAt: Date | null
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return 'Saved just now'
  if (seconds < 60) return `Saved ${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes === 1) return 'Saved 1m ago'
  return `Saved ${minutes}m ago`
}

/**
 * Tracks save status for display.
 * Watches isSaving for true -> false transitions to record lastSavedAt.
 * Ticks on a 5s interval to keep relative time fresh.
 */
export function useSaveStatus({ isSaving }: { isSaving: boolean }): SaveStatus {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [, setTick] = useState(0)
  const [prevIsSaving, setPrevIsSaving] = useState(isSaving)

  // Detect isSaving true -> false transition (adjust state during render pattern)
  if (isSaving !== prevIsSaving) {
    setPrevIsSaving(isSaving)
    if (prevIsSaving && !isSaving) {
      setLastSavedAt(new Date())
    }
  }

  // Tick every 5s to refresh relative time
  useEffect(() => {
    if (!lastSavedAt) return

    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 5000)

    return () => clearInterval(interval)
  }, [lastSavedAt])

  const statusText = isSaving ? 'Saving...' : lastSavedAt ? formatRelativeTime(lastSavedAt) : ''

  return {
    statusText,
    isSaving,
    lastSavedAt,
  }
}
