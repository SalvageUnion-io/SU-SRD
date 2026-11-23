/**
 * A Ledger's sorting: its carets, and its labels as one Tab stop (r6 E13).
 * The arrows, Home and End move between the labels, so a row's own buttons
 * are a few Tabs away, not one a column. The stop is the label last focused,
 * else the sorted one, else the first.
 */
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useState } from 'react'
import { iconSize } from '../../design/tokens'

/** `keys` in head order; a falsy entry is a label not drawn. */
export function useSortRove(
  keys: readonly (string | false | undefined)[],
  sorted: string | undefined
) {
  const sortKeys = keys.filter((key): key is string => typeof key === 'string')
  const [roving, setRoving] = useState<string | undefined>(undefined)
  const stop =
    [roving, sorted].find((key) => key !== undefined && sortKeys.includes(key)) ?? sortKeys[0]
  const rove = (key: string) => ({
    tabIndex: key === stop ? 0 : -1,
    onFocus: () => setRoving(key),
  })
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[event.key]
    const edge = event.key === 'Home' ? 0 : event.key === 'End' ? -1 : undefined
    if (step === undefined && edge === undefined) return
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button.su-ledger__sort'),
    ]
    const at = buttons.indexOf(event.target as HTMLButtonElement)
    if (at < 0) return
    event.preventDefault()
    const next =
      edge === 0
        ? buttons[0]
        : edge === -1
          ? buttons[buttons.length - 1]
          : buttons[(at + (step ?? 0) + buttons.length) % buttons.length]
    next?.focus()
  }
  return { rove, onKeyDown }
}

export type LedgerSort = { key: string; descending: boolean }

/** The sorted column's mark: a chevron at the Mini Size (K11), up for ascending. */
function sortMark(sort: LedgerSort): ReactNode {
  const Mark = sort.descending ? ChevronDown : ChevronUp
  return <Mark aria-hidden="true" size={iconSize.mini} className="su-ledger__arrow" />
}

/**
 * A sortable head's caret slot: the mark where the list sorts by this column,
 * else a muted up-and-down one in the same room, so no label widens when you
 * sort and every sortable label says it sorts.
 */
export function sortSlot(sort: LedgerSort | undefined, key: string): ReactNode {
  return sort?.key === key ? (
    sortMark(sort)
  ) : (
    <ChevronsUpDown
      aria-hidden="true"
      size={iconSize.mini}
      className="su-ledger__arrow"
      data-idle=""
    />
  )
}
