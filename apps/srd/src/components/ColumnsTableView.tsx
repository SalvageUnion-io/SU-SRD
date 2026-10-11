import { Button, InlineRef } from 'component-lib'
import type { ColumnsRollState, ColumnsTablePageData } from '../lib/columnsTablePage'
import { columnsHit } from '../lib/columnsTablePage'
import { rangeLabel } from '../lib/rollTablePage'

/**
 * ColumnsTableView — a two-roll `columns` table's page (Callsign Table, board
 * 08b): roll for the column, then for the entry down it.
 *
 * The page keeps the roll-table page's shape: the "You rolled" panel (Roll
 * again fixed under its head, then the result and the earlier rolls) and the
 * table beside it. The table is a grid: the columns' ranges across the top,
 * the entry numbers down both outer edges, every entry a cell. A roll sets
 * its column's head and its cell in ink.
 *
 * Presentational, as `RollTableView` is: the server draws it with no roll and
 * `ColumnsTableIsland` mounts it live.
 */

type ColumnsTableViewProps = {
  data: ColumnsTablePageData
  state: ColumnsRollState
  /** Roll both dice. Absent on the server, where the button is inert. */
  onRoll?: () => void
}

export function ColumnsTableView({ data, state, onRoll }: ColumnsTableViewProps) {
  const { roll, history } = state
  const hit = roll ? columnsHit(data.columns, roll) : undefined
  // The entry numbers down the edges are the first column's, as the book prints them.
  const entryKeys = data.columns[0]?.entries.map((entry) => entry.key) ?? []

  return (
    <div className="srd-roll">
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
        <div className="srd-roll__stamp-row">
          <span className="srd-roll__stamp">Roll twice:</span>
          <span aria-hidden="true" className="srd-roll__leader" />
          <span className="srd-roll__hint">The column, then the entry</span>
        </div>
        <div className="srd-cols">
          <table className="srd-cols__table" data-has-roll={hit ? 'true' : undefined}>
            <caption className="srd-vh">{data.name}</caption>
            <thead>
              <tr>
                <th scope="col" className="srd-cols__edge">
                  <span className="srd-vh">Entry</span>
                </th>
                {data.columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="srd-cols__head"
                    data-rolled={hit?.column.key === column.key ? 'true' : undefined}
                  >
                    {rangeLabel(column.key)}
                  </th>
                ))}
                <th scope="col" className="srd-cols__edge">
                  <span className="srd-vh">Entry</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entryKeys.map((entryKey, row) => (
                <tr key={entryKey}>
                  <th scope="row" className="srd-cols__edge">
                    {rangeLabel(entryKey)}
                  </th>
                  {data.columns.map((column) => {
                    const entry = column.entries[row]
                    const rolled =
                      !!entry && hit?.column.key === column.key && hit.entry.key === entry.key
                    return (
                      <td
                        key={column.key}
                        className="srd-cols__cell"
                        data-rolled={rolled ? 'true' : undefined}
                        aria-current={rolled ? 'true' : undefined}
                      >
                        {entry?.value}
                      </td>
                    )
                  })}
                  <td aria-hidden="true" className="srd-cols__edge">
                    {rangeLabel(entryKey)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
