/**
 * An open picker holds one entry in the browser's history, so Back closes it
 * and the sheet stays (r5 C5), as Back closes a Peek (`peekHistory.ts`) and
 * steps a wizard back. The entry is the page's own address and state, marked:
 * the router reads the same place and stays. A picker closed another way
 * (Done, Escape, a pick) steps back over its entry, so none outlives it.
 */

import { useEffect, useRef } from 'react'

const MARK = 'suPicker'

const marked = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && MARK in state

/** Hold a history entry while `open`; Back calls `close`. */
export function usePickerHistory(open: boolean, close: () => void): void {
  const latest = useRef(close)
  latest.current = close
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined
    const { history } = window
    const state = history.state
    history.pushState({ ...(typeof state === 'object' ? state : {}), [MARK]: true }, '')
    let held = true
    const onPop = () => {
      if (!held) return
      held = false
      latest.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // Closed another way: step back over the entry it held.
      if (held && marked(history.state)) history.back()
    }
  }, [open])
}
