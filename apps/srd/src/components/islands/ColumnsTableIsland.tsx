import { rollD20 } from 'component-lib'
import { useState } from 'react'
import type { ColumnsRollState, ColumnsTablePageData } from '../../lib/columnsTablePage'
import { recordColumnsRoll } from '../../lib/columnsTablePage'
import { ColumnsTableView } from '../ColumnsTableView'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type ColumnsTableIslandProps = {
  data: ColumnsTablePageData
  /** The die. Injectable so a test controls the rolls; a plain Randsum d20. */
  d20?: () => number
}

/**
 * A two-roll `columns` table's page, live (Callsign Table): Roll rolls the
 * column's d20, then the entry's, and keeps the earlier rolls. Its props are
 * the page's table, digested at build time, so the island reads no game data.
 */
export function ColumnsTableIsland({ data, d20 = rollD20 }: ColumnsTableIslandProps) {
  const [state, setState] = useState<ColumnsRollState>({ roll: null, history: [] })

  const onRoll = () => {
    const column = d20()
    const entry = d20()
    setState((current) => recordColumnsRoll(current, { column, entry }))
  }

  return (
    <IslandErrorBoundary>
      <ColumnsTableView data={data} state={state} onRoll={onRoll} />
    </IslandErrorBoundary>
  )
}
