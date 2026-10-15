import { useState } from 'react'
import type { ColumnsRoll, ColumnsTablePageData } from '../../lib/columnsTablePage'
import { columnsAnnouncement } from '../../lib/columnsTablePage'
import { rollD20, Toaster, toastRoll } from '../../ui/index'
import { ColumnsTableView } from '../ColumnsTableView'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type ColumnsTableIslandProps = {
  data: ColumnsTablePageData
  /** The page's band colour, which the table's rows band in. */
  tone?: string
  /** The die. Injectable so a test controls the rolls; a plain Randsum d20. */
  d20?: () => number
}

/**
 * A two-roll `columns` table's page, live (Callsign Table): Roll rolls the
 * column's d20, then the entry's, marks the cell and raises the result as a
 * toast (`toastRoll`) in its own `<Toaster />`. Its props are the page's table,
 * digested at build time, so the island reads no game data.
 */
export function ColumnsTableIsland({ data, tone, d20 = rollD20 }: ColumnsTableIslandProps) {
  const [roll, setRoll] = useState<ColumnsRoll | null>(null)

  const onRoll = () => {
    const next = { column: d20(), entry: d20() }
    setRoll(next)
    const announced = columnsAnnouncement(data, next)
    if (announced) toastRoll(announced)
  }

  return (
    <IslandErrorBoundary>
      <ColumnsTableView data={data} tone={tone} roll={roll} onRoll={onRoll} />
      <Toaster />
    </IslandErrorBoundary>
  )
}
