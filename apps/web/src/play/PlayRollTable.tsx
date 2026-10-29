import { Copy } from 'lucide-react'
import { useState } from 'react'
import type { RefObjectTable } from 'salvageunion-reference'
import { NO_EFFECT, plainTraitText, rollOnTable } from 'salvageunion-reference'
import type { RollTableType } from '../components/index'
import {
  Button,
  CopiedIcon,
  CopiedStatus,
  digestColumnsTable,
  digestRollTable,
  RollTableInstrument,
  TraitProse,
  toast,
  toastRoll,
  tokens,
  useCopied,
} from '../components/index'
import { dieForTable } from '../lib/dice'
import { playCopy } from '../messages/play'

/** Where a roll landed, and the words it reads as (the toast, the log, Copy). */
type Landed =
  | { kind: 'bands'; key: string; roll: number; text: string }
  | { kind: 'columns'; column: string; entry: string; text: string }
  | { kind: 'none'; roll: number; text: string }

/**
 * Play's roll table (the Tables column): the shared
 * `RollTableInstrument` (EDL E14), as every card and SRD page draws it, banded
 * in the surface's `tone`. This file is only the host: the dice, the toast, the
 * Game log hand-off and the Copy of the last result.
 *
 * - The instrument's Roll the Die button is the one roll control; pressing it
 *   again rolls again, and the mark moves.
 * - A named table rolls through @randsum/salvageunion (`dieForTable`), any
 *   other on a plain d20; `rollOnTable` reads the row by the same total, or
 *   for a COLUMNS table (Callsign) two d20s: the column, then the entry.
 * - Every roll is a toast (`toastRoll`) and is handed to `onRollResult`, which
 *   Play records on its roll log (ruleset §1.3), a roll on no row as
 *   `NO_EFFECT`.
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

  /**
   * One roll on the table (`rollOnTable` owns the flat-vs-columns branch, as
   * the Training Bay and the bot read it): a banded row, a column's entry, or
   * a roll that lands on no row (`NO_EFFECT`), which is still a roll.
   */
  const roll = () => {
    dieForTable(name)
      .then((d20) => {
        const outcome = rollOnTable(table as RefObjectTable, d20)
        if (!outcome.success) return
        if (outcome.kind === 'columns') {
          const { columnKey, columnRoll, entryRoll, value } = outcome
          const entryKey = String(outcome.entryKey)
          setLanded({ kind: 'columns', column: columnKey, entry: entryKey, text: value })
          onRollResult?.(value, entryKey, [columnRoll, entryRoll])
          toastRoll({
            table: name,
            roll: entryRoll,
            range: `column ${columnKey.replace('-', '–')}`,
            text: value,
          })
          return
        }
        if (outcome.kind === 'no-effect') {
          setLanded({ kind: 'none', roll: outcome.roll, text: NO_EFFECT })
          onRollResult?.(NO_EFFECT, '', [outcome.roll])
          toastRoll({ table: name, roll: outcome.roll, text: NO_EFFECT })
          return
        }
        const { key, roll: die } = outcome
        // The row as this table draws it, by the same key.
        const entry = rows.find((row) => row.key === key) ?? {
          label: outcome.label,
          value: outcome.value,
        }
        const text = entry.label ? `${entry.label}: ${entry.value}` : entry.value
        setLanded({ kind: 'bands', key, roll: die, text })
        onRollResult?.(text, key, [die])
        toastRoll({
          table: name,
          roll: die,
          range: key.replace('-', '–'),
          ...(entry.label ? { label: entry.label } : {}),
          text: plainTraitText(entry.value),
        })
      })
      .catch(() => toast(playCopy('rollFailed')))
  }

  // Copied is the control's own Check swap and a polite status, never a toast
  // (chrome K5); a refused clipboard (an insecure page, an iframe) says so.
  const { copied, flash } = useCopied()
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(flash, () => toast(playCopy('copyFailed')))
  }

  return (
    <RollTableInstrument
      name={name}
      title={name}
      size={size}
      tone={tone}
      stamp={isColumns ? 'Roll the Dice:' : undefined}
      onRoll={roll}
      actions={
        landed ? (
          <>
            <Button
              size="compact"
              className="su-roll__control"
              onClick={() => copy(landed.text)}
              aria-label={playCopy('copyResultToClipboard')}
            >
              Copy
              <CopiedIcon
                copied={copied}
                size="compact"
                icon={<Copy aria-hidden="true" size={tokens.iconSize.compact} />}
              />
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
              rows: rows.map((row) => ({ ...row, value: <TraitProse text={row.value} /> })),
              mark: landed?.kind === 'bands' ? { key: landed.key, roll: landed.roll } : undefined,
            }
      }
    />
  )
}
