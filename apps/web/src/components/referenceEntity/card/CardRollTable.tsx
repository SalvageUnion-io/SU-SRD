import { useState } from 'react'
import type { RefObjectTable } from 'salvageunion-reference'
import { plainTraitText, resultForColumnsTable, resultForTable } from 'salvageunion-reference'
import { dieForTable, rollD20 } from '../../../lib/dice'
import { useParseTraitReferences } from '../../../lib/parseTraitReferences'
import {
  digestColumnsTable,
  digestRollTable,
  withNothingHappens,
} from '../../compositions/digestRollTable'
import { RollTableInstrument } from '../../compositions/RollTableInstrument'
import { rollRangeLabel } from '../../compositions/rollTableBands'
import type { CardSize } from '../../containers/displayMode'
import { toastRoll } from '../../containers/toastRoll'
import { RollMini } from '../../entity/forms/RollMini'

/** A roll on this table: the die and the row it landed on. */
export type CardRoll = { roll: number; key: string }

/** A pair of rolls on a columns table: where they landed, and the entry's die. */
type ColumnsRoll = { column: string; entry: string; roll: number; value: string }

/** A row's text, its trait references as Mentions. */
function TraitText({ text }: { text: string }) {
  return <>{useParseTraitReferences(text)}</>
}

/**
 * An entity's own ROLL TABLE (EDL E14, R8): the shared `RollTableInstrument`,
 * OPEN on its Page or guide step, flush under the rule above its bar, its
 * bands showing without a click, on the server as in the browser. Its ROLL
 * THE DIE stamp is the one roll control (press it again to reroll).
 *
 * The result is a TOAST (`toastRoll`), as every roll's is: the number, the
 * range it lands on, the outcome and its text. The table also marks the
 * matching row, the instrument's mark: the same whatever the outcome, so the
 * web never colours a roll by how it went (ruleset §3.4).
 *
 * The rows are banded in the SURFACE TONE (`tone`: a guide's own colour, for
 * the tables in its steps), cream on a surface with none.
 *
 * A COLUMNS table (Callsign, a d20 × d20) is the same instrument and the same
 * bar: its Roll the Dice stamp rolls both dice, the toast names the column, and
 * the grid marks the column's head and the entry's cell.
 *
 * NESTED in another card (`nested`), the table is a Mini (`RollMini`, the
 * Mini form's own): its name Peeks the table (`peekAt`, `PeekTable`), its
 * roll in its strip, so the rows never open in the card.
 */
export function CardRollTable({
  table: bookTable,
  name,
  size,
  disabled,
  defaultRoll,
  nested = false,
  tone,
  onRollResult,
  peekAt,
}: {
  table: RefObjectTable
  /** The table's name, for the bar. */
  name: string
  size: CardSize
  /** A damaged host: the table reads, but there is no Roll. */
  disabled: boolean
  /** Start rolled at this die (a restored roll). */
  defaultRoll?: number
  /** Inside another card: the table is a Mini, its Roll in its strip, its rows its Peek's. */
  nested?: boolean
  /** The surface's tone (a CSS colour), whose band paints every other row. */
  tone?: string
  /** Called with the outcome's text (and its range key) on every roll. */
  onRollResult?: (text: string, key: string) => void
  /** Nested: the table's Peek address (`tablePeekAddress`); none, and its name only reads. */
  peekAt?: string
}) {
  // A "20"-only table reads with its "1–19: Nothing happens." row (owner, round 4).
  const table = withNothingHappens(bookTable)
  const isColumns = table.type === 'columns'
  const [rolled, setRolled] = useState<CardRoll | null>(() =>
    defaultRoll != null && !isColumns
      ? { roll: defaultRoll, key: resultForTable(table, defaultRoll).key }
      : null
  )
  const [rolledColumns, setRolledColumns] = useState<ColumnsRoll | null>(null)

  const rows = isColumns ? [] : digestRollTable(table)

  const rollBands = () => {
    // A named table (the Core Mechanic's own card) rolls through
    // @randsum/salvageunion; an entity's table gets Randsum's plain d20. Either
    // way the row is read from this table's data, by the total.
    void dieForTable(name).then((d20) => {
      const die = d20()
      const { key } = resultForTable(table, die)
      setRolled({ roll: die, key })
      const entry = rows.find((row) => row.key === key)
      if (!entry) return
      onRollResult?.(entry.label ? `${entry.label}: ${entry.value}` : entry.value, key)
      toastRoll({
        table: name,
        roll: die,
        range: rollRangeLabel(key),
        ...(entry.label ? { label: entry.label } : {}),
        text: plainTraitText(entry.value),
      })
    })
  }

  const rollColumns = () => {
    // Two plain d20s: a columns table is never a named Salvage Union table.
    const entryRoll = rollD20()
    const res = resultForColumnsTable(table, rollD20(), entryRoll)
    if (!res.success) return
    const { columnKey, entryKey, result } = res
    setRolledColumns({ column: columnKey, entry: entryKey, roll: entryRoll, value: result.value })
    onRollResult?.(result.value, entryKey)
    toastRoll({
      table: name,
      roll: entryRoll,
      range: `column ${rollRangeLabel(columnKey)}`,
      text: result.value,
    })
  }

  const stamp = isColumns ? 'Roll the Dice:' : 'Roll the Die:'
  const onRoll = disabled ? undefined : isColumns ? rollColumns : rollBands

  if (nested) {
    return (
      <RollMini
        name={name}
        stamp={stamp}
        {...(onRoll ? { onRoll } : {})}
        {...(peekAt ? { peekAt } : {})}
      />
    )
  }

  return (
    <RollTableInstrument
      name={name}
      title={name}
      size={size}
      tone={tone}
      frame="rule"
      stamp={stamp}
      onRoll={onRoll}
      table={
        isColumns
          ? {
              kind: 'columns',
              columns: digestColumnsTable(table),
              mark: rolledColumns ?? undefined,
            }
          : {
              kind: 'bands',
              rows: rows.map((row) => ({ ...row, value: <TraitText text={row.value} /> })),
              mark: rolled ?? undefined,
            }
      }
    />
  )
}
