import { Button, InlineRef, RollTableInstrument } from 'component-lib'
import type { ColumnsRollState, ColumnsTablePageData } from '../lib/columnsTablePage'
import { columnsHit } from '../lib/columnsTablePage'
import { rangeLabel } from '../lib/rollTablePage'

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
  state: ColumnsRollState
  /** Roll both dice. Absent on the server, where the button is inert. */
  onRoll?: () => void
}

export function ColumnsTableView({ data, tone, state, onRoll }: ColumnsTableViewProps) {
  const { roll, history } = state
  const hit = roll ? columnsHit(data.columns, roll) : undefined

  return (
    // Twenty rows of five columns under a note: always the compact setting.
    <div className="srd-roll" data-density="compact">
      <section className="srd-roll__panel" aria-labelledby="roll-panel-title">
        <div className="srd-roll__panel-head">
          <h2 id="roll-panel-title" className="srd-roll__panel-title">
            You rolled
          </h2>
          <span className="srd-roll__panel-name">{data.name}</span>
        </div>

        <div className="srd-roll__controls">
          <Button
            variant="primary"
            size="full"
            className="srd-roll__roll"
            onClick={onRoll}
            disabled={!onRoll}
          >
            {roll === null ? 'Roll the dice' : 'Roll again'}
          </Button>
          <p className="srd-roll__credit">
            Dice rolling powered by{' '}
            <InlineRef href="https://randsum.dev" target="_blank" rel="noopener noreferrer">
              Randsum.dev
            </InlineRef>
          </p>
        </div>

        <div aria-live="polite" className="srd-roll__result">
          {roll === null || !hit ? (
            <p className="srd-roll__prompt">
              Roll twice: the first d20 picks the column, the second the entry down it.
            </p>
          ) : (
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
          )}
        </div>

        {history.length > 0 && (
          <div className="srd-roll__earlier">
            <h3 className="srd-roll__earlier-title">Earlier rolls</h3>
            <ol className="srd-roll__earlier-list">
              {history.map((earlier, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a roll history repeats values; its position is its identity
                <li key={index} className="srd-roll__earlier-row">
                  <span className="srd-roll__earlier-n">{earlier.entry}</span>
                  <span className="srd-roll__earlier-outcome">
                    {columnsHit(data.columns, earlier)?.entry.value ?? 'No entry'}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <div className="srd-roll__main">
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
      </div>
    </div>
  )
}
