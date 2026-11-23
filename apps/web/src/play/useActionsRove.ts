/**
 * The Actions list as one Tab stop (r7 B8), as a Ledger's sort labels are
 * (`useSortRove`): the closed rows' Use buttons are one stop, the arrows,
 * Home and End move between them, and the stop is the Use last focused, else
 * the first; a Passive, which never opens, is a stop by its name. What else
 * a closed row holds (its name's Peek, a keyword's link, its More) is reached
 * once the row is open, so an action is one Tab, not five. An open row, and
 * a row with other controls and no Use to press (the Reactor, Mount, a row
 * offline), keeps its own Tab order.
 *
 * DOM-only: the rows re-render on their own, so the stops are set again on
 * every change under the list (`MutationObserver`).
 */

import type { RefObject } from 'react'
import { useEffect } from 'react'

/** What a keyboard reaches. */
const FOCUSABLE = ['a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]'].join()

/**
 * A closed row's stop: its Use, while it can be pressed; a Passive, which
 * has no control at all, its name. A row with other controls and no Use to
 * press (the Reactor, Mount, an action offline) has none.
 */
function rowStop(row: HTMLElement): HTMLElement | null {
  if (row.hasAttribute('data-open') || row.closest('[hidden]') !== null) return null
  const use = row.querySelector<HTMLButtonElement>('.su-play-act__use')
  if (use !== null) return use.disabled ? null : use
  return row.hasAttribute('data-passive') ? row.querySelector<HTMLElement>(FOCUSABLE) : null
}

/** The rows and their stops, in the list's order. */
function roveRows(list: HTMLElement): { row: HTMLElement; stop: HTMLElement | null }[] {
  return [...list.querySelectorAll<HTMLElement>('.su-play-act')].map((row) => ({
    row,
    stop: rowStop(row),
  }))
}

/** The list's stops, in its order. */
function roveStops(list: HTMLElement): HTMLElement[] {
  return roveRows(list).flatMap(({ stop }) => (stop === null ? [] : [stop]))
}

/**
 * Make `list` one stop: the remembered stop (or the first) takes Tab, every
 * other stop and the rest of a closed row's controls leave the Tab order.
 */
function setRoveStops(list: HTMLElement, last: HTMLElement | null): void {
  const rows = roveRows(list)
  const stops = rows.flatMap(({ stop }) => (stop === null ? [] : [stop]))
  const stop = last !== null && stops.includes(last) ? last : (stops[0] ?? null)
  for (const { row, stop: own } of rows) {
    // Only a row with a stop roves: one without keeps its own order.
    const roves = own !== null
    for (const el of row.querySelectorAll<HTMLElement>(FOCUSABLE)) {
      const wanted = roves ? (el === stop ? '0' : '-1') : null
      if (wanted === null) {
        // Back to its own order once the row opens, or has no stop; its own
        // tabindex, if it had one, comes back with it.
        const was = el.dataset.roved
        if (was !== undefined) {
          if (was === '') el.removeAttribute('tabindex')
          else el.setAttribute('tabindex', was)
          delete el.dataset.roved
        }
      } else if (el.getAttribute('tabindex') !== wanted) {
        el.dataset.roved ??= el.getAttribute('tabindex') ?? ''
        el.setAttribute('tabindex', wanted)
      }
    }
  }
}

/** Keep `ref`'s list one Tab stop, the arrows moving between its Use buttons. */
export function useActionsRove(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const list = ref.current
    if (list === null) return
    let last: HTMLElement | null = null
    let setting = false
    const apply = () => {
      if (setting) return
      setting = true
      setRoveStops(list, last)
      setting = false
    }
    const onFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement
      if (!roveStops(list).includes(target) || last === target) return
      last = target
      apply()
    }
    const onKey = (event: KeyboardEvent) => {
      const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1 }[event.key]
      const edge = event.key === 'Home' ? 0 : event.key === 'End' ? -1 : undefined
      if (step === undefined && edge === undefined) return
      const stops = roveStops(list)
      const at = stops.indexOf(event.target as HTMLElement)
      if (at < 0) return
      event.preventDefault()
      const next =
        edge === 0
          ? stops[0]
          : edge === -1
            ? stops.at(-1)
            : stops[Math.min(Math.max(at + (step ?? 0), 0), stops.length - 1)]
      next?.focus()
    }
    apply()
    const watch = new MutationObserver(apply)
    watch.observe(list, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-open', 'disabled', 'hidden'],
    })
    list.addEventListener('focusin', onFocus)
    list.addEventListener('keydown', onKey)
    return () => {
      watch.disconnect()
      list.removeEventListener('focusin', onFocus)
      list.removeEventListener('keydown', onKey)
    }
  }, [ref])
}
