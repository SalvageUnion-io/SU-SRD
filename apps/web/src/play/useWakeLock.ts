/**
 * useWakeLock — keeps the screen on while `active` (table mode, play.md §11):
 * a phone on the table should not dim mid-scene.
 *
 * The Screen Wake Lock API, where the browser has it; elsewhere nothing
 * happens. The browser releases the lock whenever the page is hidden, so it is
 * asked for again each time the page is shown while still active.
 */

import { useEffect } from 'react'

type Sentinel = { release: () => Promise<void> }
type WakeLock = { request: (type: 'screen') => Promise<Sentinel> }

function wakeLock(): WakeLock | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock ?? null
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const lock = wakeLock()
    if (!active || lock === null) return
    let sentinel: Sentinel | null = null
    let done = false

    const acquire = () => {
      if (done || document.visibilityState !== 'visible') return
      lock.request('screen').then(
        (held) => {
          if (done) void held.release().catch(() => undefined)
          else sentinel = held
        },
        // Refused (battery saver, a policy): the screen dims as it always did.
        () => undefined
      )
    }

    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', acquire)
      void sentinel?.release().catch(() => undefined)
    }
  }, [active])
}
