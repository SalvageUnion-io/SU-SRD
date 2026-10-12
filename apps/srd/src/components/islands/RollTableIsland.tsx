import type { TableDie } from 'component-lib'
import { dieForTable } from 'component-lib'
import { useState } from 'react'
import type { RollState, RollTablePageData } from '../../lib/rollTablePage'
import { recordRoll } from '../../lib/rollTablePage'
import { RollTableView } from '../RollTableView'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type RollTableIslandProps = {
  data: RollTablePageData
  /**
   * The die for this table. Injectable so a test controls the roll; defaults
   * to `dieForTable` — @randsum/salvageunion's `rollTable` for a named Salvage
   * Union table, Randsum's plain d20 for any other.
   */
  dieFor?: (tableName: string) => Promise<TableDie>
}

/**
 * The roll-table page, live (board 08b): Roll, and the earlier rolls. Its props are the page's table, already digested at build
 * time, so the island reads no game data on mount: the dice package (and the
 * roll-table data it reads) loads on the first Roll, through `dieForTable`'s
 * dynamic import, and never ships in the island's own bundle.
 */
export function RollTableIsland({ data, dieFor = dieForTable }: RollTableIslandProps) {
  const [state, setState] = useState<RollState>({ roll: null, history: [] })

  const onRoll = () => {
    void dieFor(data.name).then((d20) => {
      const next = d20()
      setState((current) => recordRoll(current, next))
    })
  }

  return (
    <IslandErrorBoundary>
      <RollTableView data={data} state={state} onRoll={onRoll} />
    </IslandErrorBoundary>
  )
}
