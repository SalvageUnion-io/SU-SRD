/**
 * One vital, one Tab stop (r3 J4): a live vital's controls (its number, the
 * gauge's slider, − and +) share a roving tabindex, so Tab steps from vital
 * to vital and ← / → move between one vital's controls. On the slider ↑ / ↓,
 * Home and End still set the value; ← / → are the row's.
 *
 * A step that empties or fills the vital disables the button that was
 * pressed: the row hands the focus to the nearest control still there, so the
 * next key is never the page's.
 */

import type { FocusEvent, KeyboardEvent, RefObject } from 'react'
import { useEffect, useRef } from 'react'

/** Every control a vital's row may hold, in reading order, pressable or not. */
const CONTROLS = 'button, [role="slider"]'

const pressable = (el: HTMLElement) => !(el instanceof HTMLButtonElement && el.disabled)

/** The row's controls that take the focus now, in reading order. */
export function vitalStops(row: HTMLElement): HTMLElement[] {
  return [...row.querySelectorAll<HTMLElement>(CONTROLS)].filter(pressable)
}

/** The stop ← or → moves to from `from`, or null at the row's end. */
export function nextStop(
  stops: readonly HTMLElement[],
  from: Element | null,
  key: string
): HTMLElement | null {
  const at = stops.findIndex((stop) => stop === from)
  if (at === -1) return null
  return stops[at + (key === 'ArrowLeft' ? -1 : 1)] ?? null
}

/** The pressable control nearest `gone` in reading order: where its focus goes when it is disabled. */
export function nearestStop(row: HTMLElement, gone: HTMLElement): HTMLElement | null {
  const all = [...row.querySelectorAll<HTMLElement>(CONTROLS)]
  const at = all.indexOf(gone)
  if (at === -1) return null
  for (let step = 1; step < all.length; step++) {
    // The next one first: − emptied the vital, so + is the control beside it.
    const near = [all[at + step], all[at - step]].find((el) => el !== undefined && pressable(el))
    if (near !== undefined) return near
  }
  return null
}

/** The row's one Tab stop: the control last used, else the first. */
function rove(row: HTMLElement, current: HTMLElement | null): HTMLElement | null {
  const stops = vitalStops(row)
  const stop = current !== null && stops.includes(current) ? current : (stops[0] ?? null)
  for (const el of row.querySelectorAll<HTMLElement>(CONTROLS)) el.tabIndex = el === stop ? 0 : -1
  return stop
}

/** The props a vital's row wears to be one Tab stop. */
export function useVitalKeys(): {
  ref: RefObject<HTMLDivElement | null>
  onKeyDownCapture: (event: KeyboardEvent) => void
  onFocusCapture: (event: FocusEvent) => void
  onBlurCapture: (event: FocusEvent) => void
} {
  const ref = useRef<HTMLDivElement | null>(null)
  const current = useRef<HTMLElement | null>(null)
  const within = useRef(false)
  // After every render: a step may have disabled the control in use.
  useEffect(() => {
    const row = ref.current
    if (row === null) return
    const was = current.current
    const lost =
      within.current &&
      was !== null &&
      !pressable(was) &&
      (document.activeElement === was || document.activeElement === document.body)
    if (lost && was !== null) current.current = nearestStop(row, was)
    current.current = rove(row, current.current)
    if (lost) current.current?.focus()
  })
  return {
    ref,
    onKeyDownCapture: (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const row = ref.current
      if (row === null) return
      const next = nextStop(vitalStops(row), document.activeElement, event.key)
      // Also at the row's end: ← / → never reach the slider as a change.
      event.preventDefault()
      event.stopPropagation()
      next?.focus()
    },
    onFocusCapture: (event) => {
      const row = ref.current
      if (row === null || !(event.target instanceof HTMLElement)) return
      within.current = true
      if (event.target.matches(CONTROLS)) current.current = rove(row, event.target)
    },
    onBlurCapture: (event) => {
      // Left for somewhere else on the page; a control disabled under the focus names nowhere.
      if (event.relatedTarget instanceof Node && !ref.current?.contains(event.relatedTarget))
        within.current = false
    },
  }
}
