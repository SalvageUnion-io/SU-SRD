import type { TableDie } from 'component-lib'
import { d20ForTable } from 'component-lib'
import { useState } from 'react'
import type { RollState, RollTablePageData } from '../../lib/rollTablePage'
import { parseTypedRoll, recordRoll } from '../../lib/rollTablePage'
import { RollTableView } from '../RollTableView'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type RollTableIslandProps = {
  data: RollTablePageData
  /**
   * The die for this table. Injectable so a test controls the roll; defaults
   * to `d20ForTable` — @randsum/salvageunion's `rollTable` for a named Salvage
   * Union table, Randsum's plain d20 for any other.
   */
  dieFor?: (tableName: string) => Promise<TableDie>
}

/**
 * The roll-table page, live (board 08b): Roll, a typed physical roll, and the
 * earlier rolls. Its props are the page's table, already digested at build
 * time, so the island reads no game data on mount: the dice package (and the
 * roll-table data it reads) loads on the first Roll, through `d20ForTable`'s
 * dynamic import, and never ships in the island's own bundle.
 */
export function RollTableIsland({ data, dieFor = d20ForTable }: RollTableIslandProps) {
  const [state, setState] = useState<RollState>({ roll: null, history: [] })
  const [typed, setTyped] = useState('')

  const onRoll = () => {
    void dieFor(data.name).then((d20) => {
      const next = d20()
      setState((current) => recordRoll(current, next))
      setTyped(String(next))
    })
  }

  const onTypedCommit = () => {
    const value = parseTypedRoll(typed)
    if (value === undefined || value === state.roll) return
    setState((current) => recordRoll(current, value))
  }

  return (
    <IslandErrorBoundary>
      <RollTableView
        data={data}
        state={state}
        onRoll={onRoll}
        typed={typed}
        onTypedChange={setTyped}
        onTypedCommit={onTypedCommit}
      />
    </IslandErrorBoundary>
  )
}
