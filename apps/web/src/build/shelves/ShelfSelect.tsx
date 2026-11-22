/**
 * A shelf's Select (r6 E3): tidying twenty builds is one gesture. Select puts
 * a check on each line (shift-click checks the range from the last one),
 * and `Delete 3` deletes them at once under one notice with one Undo. It
 * stands in the shelf's find bar, once there are two lines to choose from.
 */
import type { MouseEvent, ReactNode } from 'react'
import { useState } from 'react'
import { Button, Checkbox } from '../../components/index'
import { buildShelvesCopy } from '../../messages/build-shelves'

/** The ids a click checks or clears: one, or with shift the range from the last clicked. */
export function rangeOf(
  order: readonly string[],
  last: string | undefined,
  id: string,
  shift: boolean
): string[] {
  const at = order.indexOf(id)
  const from = last === undefined ? -1 : order.indexOf(last)
  if (!shift || from < 0 || at < 0) return [id]
  const [lo, hi] = from < at ? [from, at] : [at, from]
  return order.slice(lo, hi + 1)
}

export type ShelfSelect = {
  /** The bar's Select, or while selecting its `Delete N` and Done. */
  bar: ReactNode
  /** While selecting, a line's check, in place of its acts. */
  check: ((id: string, name: string) => ReactNode) | undefined
}

/**
 * `order` is the lines' ids as shown; `all` every line's, found or not;
 * `pickable` those a delete may take (a Mech in a Game is not: its delete
 * asks); `remove` deletes the checked.
 */
export function useShelfSelect(
  order: readonly string[],
  all: readonly string[],
  pickable: (id: string) => boolean,
  remove: ((ids: string[]) => void) | undefined
): ShelfSelect {
  const [on, setOn] = useState(false)
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [last, setLast] = useState<string | undefined>(undefined)
  if (remove === undefined || all.filter(pickable).length < 2)
    return { bar: undefined, check: undefined }
  const shown = order.filter((id) => checked.has(id) && pickable(id))
  const stop = () => {
    setOn(false)
    setChecked(new Set())
    setLast(undefined)
  }
  const click = (id: string, event: MouseEvent<HTMLInputElement>) => {
    const next = !checked.has(id)
    const ids = rangeOf(order, last, id, event.shiftKey).filter(pickable)
    setChecked((held) => {
      const out = new Set(held)
      for (const one of ids) {
        if (next) out.add(one)
        else out.delete(one)
      }
      return out
    })
    setLast(id)
  }
  const bar = on ? (
    <span className="su-shelf-select">
      <Button
        variant="primary"
        size="compact"
        disabled={shown.length === 0}
        onClick={() => {
          remove(shown)
          stop()
        }}
      >
        {buildShelvesCopy('deleteSelected', { count: String(shown.length) })}
      </Button>
      <Button variant="ghost" size="compact" onClick={stop}>
        {buildShelvesCopy('selectDone')}
      </Button>
    </span>
  ) : (
    <Button variant="ghost" size="compact" onClick={() => setOn(true)}>
      {buildShelvesCopy('select')}
    </Button>
  )
  return {
    bar,
    check: on
      ? (id, name) =>
          pickable(id) ? (
            <Checkbox
              hitArea
              aria-label={buildShelvesCopy('selectName', { name })}
              checked={checked.has(id)}
              onChange={() => undefined}
              onClick={(event) => click(id, event)}
            />
          ) : undefined
      : undefined,
  }
}
