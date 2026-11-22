/**
 * "/" jumps to Play's action search (r3 J4): from anywhere on the screen but
 * a field being typed in, the slash key puts the caret in Find, its text
 * selected, so a keyboard player reaches an action without tabbing past every
 * vital.
 */

import type { RefObject } from 'react'
import { useEffect } from 'react'
import { isTyping } from '../lib/searchShortcut'

/** While mounted, "/" focuses the search field inside `within`. */
export function useFindKey(within: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.defaultPrevented || isTyping(event.target)) return
      const field = within.current?.querySelector<HTMLInputElement>('input')
      // A hidden pane's Find (a sheet on the screen) takes no focus: leave the key alone.
      if (field == null || field.closest('[hidden]') !== null) return
      event.preventDefault()
      field.focus()
      field.select()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [within])
}
