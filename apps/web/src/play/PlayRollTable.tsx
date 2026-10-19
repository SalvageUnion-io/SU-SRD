import { Copy } from 'lucide-react'
import { useState } from 'react'
import type { RefObjectTable } from 'salvageunion-reference'
import { plainTraitText, resultForColumnsTable, resultForTable } from 'salvageunion-reference'
import type { RollTableType } from '../components/index'
import {
  Button,
  CopiedIcon,
  CopiedStatus,
  digestColumnsTable,
  digestRollTable,
  RollTableInstrument,
  toastRoll,
  useCopied,
  useParseTraitReferences,
} from '../components/index'
import { dieForTable, rollD20 } from '../lib/rollTableDice'

/** A row's text, its trait references as Mentions. */
function TraitText({ text }: { text: string }) {
  return <>{useParseTraitReferences(text)}</>
}

/** Where a roll landed, and the words it reads as (the toast, the log, Copy). */
type Landed =
  | { kind: 'bands'; key: string; roll: number; text: string }
  | { kind: 'columns'; column: string; entry: string; text: string }

/**
 * Play's roll table (the Tables column): the shared
 * `RollTableInstrument` (EDL E14), as every card and SRD page draws it, banded
 * in the surface's `tone`. This file is only the host: the dice, the toast, the
 * Game log hand-off and the Copy of the last result.
 *
 * - The instrument's Roll the Die button is the one roll control; pressing it
 *   again rolls again, and the mark moves.
 * - A named table rolls through @randsum/salvageunion (`dieForTable`); the row
 *   is read from this table's own data, by the same total. A COLUMNS table
 *   (Callsign) rolls two plain d20s: the column, then the entry.
 * - Every roll is a toast (`toastRoll`) and is handed to `onRollResult`, which
 *   Play records on its roll log (ruleset §1.3).
 */
export function PlayRollTable({
  table,
  name,
  size = 'full',
  tone,
  onRollResult,
}: {
  table: RollTableType
  /** The table's name: the bar's title, the toast's, and its die. */
  name: string
  /** `full` reads a table on its own; `mini` is the Tables column's. */
  size?: 'full' | 'mini'
  /** The surface's tone (a CSS colour), whose band paints every other row. */
  tone?: string
  /**
   * Called with the outcome's text, its roll key and the dice (one d20, or the
   * column's and the entry's for a COLUMNS table) on every roll.
   */
  onRollResult?: (text: string, key: string, dice: number[]) => void
}) {
  const [landed, setLanded] = useState<Landed | null>(null)
  const isColumns = table.type === 'columns'
  const rows = isColumns ? [] : digestRollTable(table)

  const rollBands = () => {
    void dieForTable(name).then((d20) => {
      const roll = d20()
      const { key } = resultForTable(table as RefObjectTable, roll)
      const entry = rows.find((row) => row.key === key)
      if (!entry) return
      const text = entry.label ? `${entry.label}: ${entry.value}` : entry.value
      setLanded({ kind: 'bands', key, roll, text })
      onRollResult?.(text, key, [roll])
      toastRoll({
        table: name,
        roll,
        range: key.replace('-', '–'),
        ...(entry.label ? { label: entry.label } : {}),
        text: plainTraitText(entry.value),
      })
    })
  }

  const rollColumns = () => {
    // Two plain d20s: a columns table is never a named Salvage Union table,
    // and @randsum/salvageunion's rollTable reads banded tables only.
    const columnRoll = rollD20()
    const entryRoll = rollD20()
    const res = resultForColumnsTable(table as RefObjectTable, columnRoll, entryRoll)
    if (!res.success) return
    const { columnKey, entryKey, result } = res
    setLanded({ kind: 'columns', column: columnKey, entry: entryKey, text: result.value })
    onRollResult?.(result.value, entryKey, [columnRoll, entryRoll])
    toastRoll({
      table: name,
      roll: entryRoll,
      range: `column ${columnKey.replace('-', '–')}`,
      text: result.value,
    })
  }

  // Copied is the control's own Check swap and a polite status, never a toast
  // (chrome K5).
  const { copied, flash } = useCopied()
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(flash)
  }

  return (
    <RollTableInstrument
      name={name}
      title={name}
      size={size}
      tone={tone}
      stamp={isColumns ? 'Roll twice:' : undefined}
      onRoll={isColumns ? rollColumns : rollBands}
      actions={
        landed ? (
          <>
            <Button
              size="compact"
              className="su-roll__toggle su-roll__control"
              onClick={() => copy(landed.text)}
              aria-label="Copy result to clipboard"
            >
              Copy
              <CopiedIcon copied={copied} size={14} icon={<Copy aria-hidden="true" size={14} />} />
            </Button>
            <CopiedStatus copied={copied} />
          </>
        ) : undefined
      }
      table={
        table.type === 'columns'
          ? {
              kind: 'columns',
              columns: digestColumnsTable(table as RefObjectTable),
              mark:
                landed?.kind === 'columns'
                  ? { column: landed.column, entry: landed.entry }
                  : undefined,
            }
          : {
              kind: 'bands',
              rows: rows.map((row) => ({ ...row, value: <TraitText text={row.value} /> })),
              mark: landed?.kind === 'bands' ? { key: landed.key, roll: landed.roll } : undefined,
            }
      }
    />
  )
}
