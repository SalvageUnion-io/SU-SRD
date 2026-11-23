/**
 * Play's keys (r3 J4, r6 A13): from anywhere on the screen but a field being
 * typed in, "/" puts the caret in Find, its text selected, so a keyboard
 * player reaches an action without tabbing past every vital; R rolls the open
 * action, A applies it (or, with nothing to apply, finishes it), E ends the
 * player's turn, N jumps to the top notice's first answer (r7 A7), and "?"
 * opens the sheet that lists them (`PlayKeysSheet`). A turn is a handful of
 * keys.
 */

import type { RefObject } from 'react'
import { useEffect, useState } from 'react'
import { isTyping } from '../lib/searchShortcut'
import { focusTopNotice, noteActionFocus } from './tableNoticesDom.model'

/** The first of `selector` that is on screen and can be pressed. */
function pressable(selector: string): HTMLElement | null {
  const found = [...document.querySelectorAll<HTMLElement>(selector)]
  return (
    found.find((el) => el.closest('[hidden]') === null && !(el as HTMLButtonElement).disabled) ??
    null
  )
}

/** An action's Roll the die, never its Push (`PlayRollInstrument`'s `pressAs`). */
export const ROLL_BUTTON = '[data-play-roll="roll"] button.su-roll__roll'

/** What each letter presses: the open action's roll, its Apply (else its Done), End my turn. */
const PRESSES: Readonly<Record<string, readonly string[]>> = {
  r: [`.su-play-act[data-open] ${ROLL_BUTTON}`],
  a: [
    '.su-play-act[data-open] [data-play-key="apply"]',
    '.su-play-act[data-open] .su-play-act__use',
  ],
  e: ['[data-end-turn]'],
}

/**
 * While mounted, "/" focuses the search field inside `within`, and R, A, E,
 * N and "?" are Play's (r6 A13, r7 A7). Answers whether the keys sheet is open, and
 * how to close it.
 */
export function useFindKey(within: RefObject<HTMLElement | null>): {
  keysOpen: boolean
  closeKeys: () => void
} {
  const [keysOpen, setKeysOpen] = useState(false)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (event.defaultPrevented || isTyping(event.target)) return
      if (event.key === '?') {
        event.preventDefault()
        setKeysOpen(true)
        return
      }
      if (event.key.toLowerCase() === 'n' && !event.shiftKey) {
        if (focusTopNotice()) event.preventDefault()
        return
      }
      const presses = PRESSES[event.key.toLowerCase()]
      if (presses !== undefined && !event.shiftKey) {
        const target = presses.map(pressable).find((el) => el !== null)
        if (target == null) return
        event.preventDefault()
        target.click()
        return
      }
      if (event.key !== '/') return
      const field = within.current?.querySelector<HTMLInputElement>('input')
      // A hidden pane's Find (a sheet on the screen) takes no focus: leave the key alone.
      if (field == null || field.closest('[hidden]') !== null) return
      event.preventDefault()
      field.focus()
      field.select()
    }
    // Where the focus stood in the actions: an answer to a notice sends it back (r7 A7).
    const onFocus = (event: FocusEvent) => noteActionFocus(event.target)
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocus)
    }
  }, [within])
  return { keysOpen, closeKeys: () => setKeysOpen(false) }
}
