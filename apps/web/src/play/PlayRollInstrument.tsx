/**
 * PlayRollInstrument — a roll Play makes in a row (play.md §5, §10): the
 * resolve's Core Mechanic, the Reactor's Heat Check, a Cantina rumour, an
 * NPC's action and its Morale. It is the shared `RollTableInstrument` (EDL
 * E14, R8), open, as the Tables column's `PlayRollTable` draws it: the stamp
 * is the one roll control, and a result is its marked row, the same mark
 * whatever the outcome (ruleset §3.4).
 *
 * Presentational: the host owns the dice, the roll log and what a roll
 * writes, and hands back the die its last roll landed on. Without `onRoll`
 * (offline, not on hand, a down NPC) the stamp only reads.
 */

import type { RefObjectTable } from 'salvageunion-reference'
import { resultForTable, SalvageUnionReference } from 'salvageunion-reference'
import { digestRollTable, RollTableInstrument, TraitProse } from '../components/index'

export type PlayRollInstrumentProps = {
  /** The table rolled on, by its name ("Core Mechanic"): its bands and its accessible name. */
  table: string
  /** The die the host's last roll on it landed on; null before one. */
  roll: number | null
  /** The roll's words: "Roll the Die:" (the default), "Push:", "Heat Check:". */
  stamp?: string
  /** Roll it; absent, the stamp only reads. */
  onRoll?: () => void
}

export function PlayRollInstrument({ table, roll, stamp, onRoll }: PlayRollInstrumentProps) {
  const data = SalvageUnionReference.RollTables.getByName(table)?.table as
    | RefObjectTable
    | undefined
  const rows = data ? digestRollTable(data) : []
  const key = roll === null || !data ? null : resultForTable(data, roll).key || null
  return (
    <RollTableInstrument
      name={table}
      size="mini"
      stamp={stamp}
      onRoll={onRoll}
      // The bar names the table it rolls on, as the Tables column's does.
      title={table}
      table={{
        kind: 'bands',
        rows: rows.map((row) => ({ ...row, value: <TraitProse text={row.value} /> })),
        mark: key === null || roll === null ? undefined : { key, roll },
      }}
    />
  )
}
