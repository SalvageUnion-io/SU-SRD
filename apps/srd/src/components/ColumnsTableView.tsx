import { RollTableInstrument } from 'component-lib'
import type { ColumnsRoll, ColumnsTablePageData } from '../lib/columnsTablePage'
import { columnsHit } from '../lib/columnsTablePage'
import type { RollState } from '../lib/rollTablePage'
import { rangeLabel } from '../lib/rollTablePage'
import { RollPanel } from './RollPanel'

/**
 * ColumnsTableView — a two-roll `columns` table's page (Callsign Table, board
 * 08b): roll for the column, then for the entry down it.
 *
 * The page keeps the roll-table page's shape: the "You rolled" panel (Roll
 * again fixed under its head, then the result and the earlier rolls) and the
 * table beside it. The table is the shared `RollTableInstrument`'s columns
 * grid, banded in the page's tone: the columns' ranges across the top, the
 * entry numbers down both outer edges, every entry a cell. A roll marks its
 * column's head and sets its cell in ink.
 *
 * Presentational, as `RollTableView` is: the server draws it with no roll and
 * `ColumnsTableIsland` mounts it live.
 */

type ColumnsTableViewProps = {
  data: ColumnsTablePageData
  /** The page's band colour, which the table's rows band in. */
  tone?: string
  state: RollState<ColumnsRoll>
  /** Roll both dice. Absent on the server, where the button is inert. */
  onRoll?: () => void
}

export function ColumnsTableView({ data, tone, state, onRoll }: ColumnsTableViewProps) {
  const { roll, history } = state
  const hit = roll ? columnsHit(data.columns, roll) : undefined

  return (
    <RollPanel
      name={data.name}
      rollLabel={roll === null ? 'Roll the dice' : 'Roll again'}
      onRoll={onRoll}
      prompt="Roll twice: the first d20 picks the column, the second the entry down it."
      result={
        roll === null || !hit ? undefined : (
          <div className="srd-roll__readout">
            <span className="srd-roll__number">{roll.entry}</span>
            <div className="srd-roll__outcome">
              <span className="srd-roll__lands">
                <span className="srd-roll__lands-label">Column {roll.column}</span>
                <span className="srd-roll__lands-range">{rangeLabel(hit.column.key)}</span>
              </span>
              <span className="srd-roll__outcome-title">{hit.entry.value}</span>
            </div>
          </div>
        )
      }
      history={history.map((earlier) => ({
        n: earlier.entry,
        label: columnsHit(data.columns, earlier)?.entry.value ?? 'No entry',
      }))}
      // Twenty rows of five columns under a note: always the compact setting.
      density="compact"
    >
      {data.description.map((paragraph) => (
        <p key={paragraph} className="srd-roll__description">
          {paragraph}
        </p>
      ))}
      <RollTableInstrument
        name={data.name}
        size="large"
        tone={tone}
        density="compact"
        stamp="Roll twice:"
        hint="The column, then the entry"
        table={{
          kind: 'columns',
          columns: data.columns,
          mark: hit ? { column: hit.column.key, entry: hit.entry.key } : undefined,
        }}
      />
    </RollPanel>
  )
}
