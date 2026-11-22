import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { whollyVisible } from '../../lib/revealRolled'
import type { RollTablePageData } from '../../lib/rollTablePage'
import { rollAnnouncement } from '../../lib/rollTablePage'
import type { TableDie } from '../index'
import { dieForTable, ToasterMount, toastRoll } from '../index'
import { RollTableView } from '../RollTableView'
import { IslandErrorBoundary } from './IslandErrorBoundary'

/** The island's own box is none: the page frame's rows stay the layout's. */
const CONTENTS = { display: 'contents' } satisfies CSSProperties

type RollTableIslandProps = {
  data: RollTablePageData
  /** The page's band colour, which the table's rows band in. */
  tone?: string
  /**
   * The die for this table. Injectable so a test controls the roll; defaults
   * to `dieForTable` — @randsum/salvageunion's `rollTable` for a named Salvage
   * Union table, Randsum's plain d20 for any other.
   */
  dieFor?: (tableName: string) => Promise<TableDie>
}

/**
 * The roll-table page, live: Roll marks the row, and the table brings it on
 * screen (`revealRolled`). The row is the result, shown once (RR6-16): a
 * toast (`toastRoll`, in the page's one toaster, `ToasterMount`) is raised only
 * when the row was off screen as it landed, and then as one short line, the
 * roll and its range. Its props are the page's table, already digested at
 * build time, so the island reads no game data on mount: the dice package
 * (and the roll-table data it reads) loads on the first Roll, through
 * `dieForTable`'s dynamic import, and never ships in the island's own bundle.
 */
export function RollTableIsland({ data, tone, dieFor = dieForTable }: RollTableIslandProps) {
  const [roll, setRoll] = useState<{ face: number; nth: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)

  const onRoll = () => {
    void dieFor(data.name).then((d20) => {
      const face = d20()
      setRoll((now) => ({ face, nth: (now?.nth ?? 0) + 1 }))
    })
  }

  // Read before the table's own effect scrolls the row into view: a layout
  // effect here runs ahead of every passive one beneath it.
  useLayoutEffect(() => {
    if (!roll) return
    const row = root.current?.querySelector('[aria-current="true"]')
    if (row && whollyVisible(row)) return
    const { table, roll: face, range } = rollAnnouncement(data, roll.face)
    toastRoll({ table, roll: face, ...(range ? { range } : {}), text: '' })
  }, [roll, data])

  return (
    <IslandErrorBoundary>
      <div ref={root} style={CONTENTS}>
        <RollTableView data={data} tone={tone} roll={roll?.face ?? null} onRoll={onRoll} />
      </div>
      <ToasterMount />
    </IslandErrorBoundary>
  )
}
