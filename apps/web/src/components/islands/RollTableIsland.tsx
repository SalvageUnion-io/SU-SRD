import { useState } from 'react'
import type { RollTablePageData } from '../../lib/rollTablePage'
import { rollAnnouncement } from '../../lib/rollTablePage'
import type { TableDie } from '../index'
import { dieForTable, ToasterMount, toastRoll } from '../index'
import { RollTableView } from '../RollTableView'
import { IslandErrorBoundary } from './IslandErrorBoundary'

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
 * The roll-table page, live: Roll marks the row and raises the
 * result as a toast (`toastRoll`) in the page's one toaster (`ToasterMount`). Its props
 * are the page's table, already digested at build time, so the island reads
 * no game data on mount: the dice package (and the roll-table data it reads)
 * loads on the first Roll, through `dieForTable`'s dynamic import, and never
 * ships in the island's own bundle.
 */
export function RollTableIsland({ data, tone, dieFor = dieForTable }: RollTableIslandProps) {
  const [roll, setRoll] = useState<number | null>(null)

  const onRoll = () => {
    void dieFor(data.name).then((d20) => {
      const next = d20()
      setRoll(next)
      toastRoll(rollAnnouncement(data, next))
    })
  }

  return (
    <IslandErrorBoundary>
      <RollTableView data={data} tone={tone} roll={roll} onRoll={onRoll} />
      <ToasterMount />
    </IslandErrorBoundary>
  )
}
