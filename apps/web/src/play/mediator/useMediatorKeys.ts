/**
 * Mediate's keys (r8 B10, MD8-19): from anywhere on the screen but a field
 * being typed in, T opens Tell the table, R rolls the open NPC action's die,
 * N moves Group Initiative on to the next side, and "?" opens the sheet that
 * lists them (`PlayKeysSheet`). The moves a Mediator repeats all night are a
 * key each.
 */

import { useEffect, useState } from 'react'
import { isTyping } from '../../lib/searchShortcut'
import { ROLL_BUTTON } from '../useFindKey'

/** What R and N press: the open action's Roll the die, and Next side. */
const PRESSES: Readonly<Record<string, string>> = {
  r: `.su-play-act[data-open] ${ROLL_BUTTON}`,
  n: '[data-initiative-next]',
}

function pressable(selector: string): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>(selector)].find(
      (el) => el.closest('[hidden]') === null && !(el as HTMLButtonElement).disabled
    ) ?? null
  )
}

/** While mounted, T, R, N and "?" are Mediate's; answers whether the keys sheet is open. */
export function useMediatorKeys(onTell: () => void): { keysOpen: boolean; closeKeys: () => void } {
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
      if (event.shiftKey) return
      const key = event.key.toLowerCase()
      if (key === 't') {
        event.preventDefault()
        onTell()
        return
      }
      const selector = PRESSES[key]
      const target = selector === undefined ? null : pressable(selector)
      if (target === null) return
      event.preventDefault()
      target.click()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onTell])
  return { keysOpen, closeKeys: () => setKeysOpen(false) }
}
