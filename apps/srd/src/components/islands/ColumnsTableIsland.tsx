import { rollD20 } from 'component-lib'
import { useState } from 'react'
import type { ColumnsRoll, ColumnsTablePageData } from '../../lib/columnsTablePage'
import type { RollState } from '../../lib/rollTablePage'
import { recordRoll } from '../../lib/rollTablePage'
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
 * column's d20, then the entry's, and keeps the earlier rolls. Its props are
 * the page's table, digested at build time, so the island reads no game data.
 */
export function ColumnsTableIsland({ data, tone, d20 = rollD20 }: ColumnsTableIslandProps) {
  const [state, setState] = useState<RollState<ColumnsRoll>>({ roll: null, history: [] })

  const onRoll = () => {
    const column = d20()
    const entry = d20()
    setState((current) => recordRoll(current, { column, entry }))
  }

  return (
    <IslandErrorBoundary>
      <ColumnsTableView data={data} tone={tone} state={state} onRoll={onRoll} />
    </IslandErrorBoundary>
  )
}
