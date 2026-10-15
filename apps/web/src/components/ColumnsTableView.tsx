import type { ColumnsRoll, ColumnsTablePageData } from '../lib/columnsTablePage'
import { columnsHit } from '../lib/columnsTablePage'
import { RollTableInstrument } from './index'
import { RollPageFrame } from './RollPageFrame'

/**
 * ColumnsTableView — a two-roll `columns` table's page (Callsign Table, board
 * 08b): roll for the column, then for the entry down it.
 *
 * The page keeps the roll-table page's shape: the prose, then the table, whose
 * Roll twice button is the roll. The table is the shared
 * `RollTableInstrument`'s columns grid, banded in the page's tone: the
 * columns' ranges across the top, the entry numbers down both outer edges,
 * every entry a cell. A roll marks its column's head and sets its cell in ink;
 * its result is a toast, as every roll's is (`ColumnsTableIsland`).
 *
 * Presentational, as `RollTableView` is: the server draws it with no roll and
 * `ColumnsTableIsland` mounts it live.
 */

type ColumnsTableViewProps = {
  data: ColumnsTablePageData
  /** The page's band colour, which the table's rows band in. */
  tone?: string
  /** The pair of rolls the grid marks, or `null` before the first. */
  roll: ColumnsRoll | null
  /** Roll both dice. Absent on the server, where the stamp is a plain label. */
  onRoll?: () => void
}

export function ColumnsTableView({ data, tone, roll, onRoll }: ColumnsTableViewProps) {
  const hit = roll ? columnsHit(data.columns, roll) : undefined

  return (
    // Twenty rows of five columns under a note: always the compact setting.
    <RollPageFrame density="compact" description={data.description}>
      <RollTableInstrument
        name={data.name}
        size="large"
        tone={tone}
        density="compact"
        stamp="Roll twice:"
        onRoll={onRoll}
        hint="The column, then the entry"
        table={{
          kind: 'columns',
          columns: data.columns,
          mark: hit ? { column: hit.column.key, entry: hit.entry.key } : undefined,
        }}
      />
    </RollPageFrame>
  )
}
