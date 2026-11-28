/**
 * Whether the page is going to paper (r4 E9): a sheet prints its Read view
 * whichever tab it is on, so Edit's dashed boxes, "+ Add" and bare fields
 * never reach a printout.
 *
 * Both signals are heard: `beforeprint` / `afterprint` (the browser's own
 * Print, and the sheet's "⋯"), and the `print` media query, which is what a
 * print preview and the suite's print-media check flip. The switch is made
 * synchronously (`flushSync`): the browser lays the page out for paper as
 * soon as `beforeprint` returns.
 */

import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

export function usePrinting(): boolean {
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const set = (next: boolean) => flushSync(() => setPrinting(next))
    const before = () => set(true)
    const after = () => set(false)
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('print') : null
    const onMedia = (event: MediaQueryListEvent) => set(event.matches)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    media?.addEventListener?.('change', onMedia)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      media?.removeEventListener?.('change', onMedia)
    }
  }, [])
  return printing
}
