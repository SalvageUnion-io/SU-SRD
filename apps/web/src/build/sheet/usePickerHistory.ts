/**
 * An open picker holds one entry in the browser's history, so Back closes it
 * and the sheet stays (r5 C5), as Back closes a Peek (`peekHistory.ts`) and
 * steps a wizard back. The entry is the page's own address and state, marked:
 * the router reads the same place and stays. A picker closed another way
 * (Done, Escape, a pick) steps back over its entry, so none outlives it.
 *
 * That step back waits a microtask: an effect torn down and run again at once
 * (React's StrictMode on a picker mounted open, Play's Spend TP) keeps the
 * entry it already holds, never Back's late popstate closing it (r7 D4).
 */

import { useEffect, useRef } from 'react'

const MARK = 'suPicker'

const marked = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && MARK in state

/** A closed picker's step back, not yet taken: a picker opening at once takes its entry over. */
let pendingBack: { cancelled: boolean } | null = null

/** Hold a history entry while `open`; Back calls `close`. */
export function usePickerHistory(open: boolean, close: () => void): void {
  const latest = useRef(close)
  latest.current = close
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined
    const { history } = window
    const state = history.state
    if (pendingBack !== null && marked(state)) {
      pendingBack.cancelled = true
      pendingBack = null
    } else {
      history.pushState({ ...(typeof state === 'object' ? state : {}), [MARK]: true }, '')
    }
    let held = true
    const onPop = () => {
      if (!held) return
      held = false
      latest.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // Closed another way: step back over the entry it held, unless it is held again at once.
      if (!held) return
      const step = { cancelled: false }
      pendingBack = step
      queueMicrotask(() => {
        if (step.cancelled) return
        pendingBack = null
        if (marked(history.state)) history.back()
      })
    }
  }, [open])
}
