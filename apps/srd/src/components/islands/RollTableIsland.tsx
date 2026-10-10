import { roll as rollDice } from '@randsum/roller'
import { useState } from 'react'
import type { RollState, RollTablePageData } from '../../lib/rollTablePage'
import { parseTypedRoll, recordRoll } from '../../lib/rollTablePage'
import { RollTableView } from '../RollTableView'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type RollTableIslandProps = {
  data: RollTablePageData
  /** The die. Injectable so a test controls the roll; defaults to Randsum's d20. */
  rollD20?: () => number
}

/** One d20, rolled by Randsum (the same engine the Discord bot's `/su roll` uses). */
function randsumD20(): number {
  return rollDice('1d20').total
}

/**
 * The roll-table page, live (board 08b): Roll, a typed physical roll, and the
 * earlier rolls. Its props are the page's table, already digested at build
 * time, so the island reads no game data and loads no ORM chunk.
 */
export function RollTableIsland({ data, rollD20 = randsumD20 }: RollTableIslandProps) {
  const [state, setState] = useState<RollState>({ roll: null, history: [] })
  const [typed, setTyped] = useState('')

  const onRoll = () => {
    const next = rollD20()
    setState((current) => recordRoll(current, next))
    setTyped(String(next))
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
