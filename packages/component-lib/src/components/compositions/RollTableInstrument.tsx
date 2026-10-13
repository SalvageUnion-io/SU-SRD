import type { CSSProperties, ReactNode } from 'react'
import type { CardSize } from '../containers/displayMode'
import { rollBandColor, rollRangeLabel } from './rollTableBands'

/**
 * RollTableInstrument — THE roll table, wherever one is drawn (EDL E14,
 * ruleset §2 "RollTable banded d20"): an entity card's own table, a guide
 * step's, and the SRD's roll-table page all draw this, so they cannot drift.
 * The book prints one table, however it is reached (pp. 88, 232).
 *
 * - The BAR: the underlined "ROLL THE DIE:" stamp, then the table's title or
 *   a hint, then whatever controls the host owns (`actions`: a card's Roll
 *   and Table / Hide; the page has none, its Roll lives in its readout).
 * - The READOUT slot under the bar (`readout`): a card's ink strip. The page
 *   adds its own "You rolled" panel beside the instrument instead.
 * - The BANDS: banded d20 rows in the SURFACE TONE (`tone`, the colour of the
 *   page or guide the table sits on): paper, then the tone's band
 *   (`rollBandColor`), in turn; a surface with no tone bands in cream. The
 *   rolled row is set in ink with a "Rolled N" pennant on its title line, the
 *   same mark whatever the outcome (ruleset §3.4); the other rows keep their
 *   ink, so every band reads at full contrast.
 * - A COLUMNS table (Callsign, a d20 × d20) is the same instrument: its rows
 *   banded the same way, the columns' ranges across an ink head and the entry
 *   numbers down both outer edges; the rolled column head and cell are marked.
 *
 * Presentational: rolling, and what a roll reads as, belong to the host. The
 * layout is `index.css`'s `.su-roll*`, sized by `size` and, on a page that
 * must end above the fold, `density` and `split`.
 */

/** One banded row: its range key ("11-19"), the outcome's name, its text. */
type RollInstrumentRow = { key: string; label: string | null; value: ReactNode }

/** One column of a columns table: its d20 range and its entries. */
type RollInstrumentColumn = {
  key: string
  entries: { key: string; value: ReactNode }[]
}

/** How tightly a wide screen sets a page's table (the SRD's `rollTableDensity`). */
type RollInstrumentDensity = 'roomy' | 'compact' | 'dense'

type BandsTable = {
  kind: 'bands'
  rows: RollInstrumentRow[]
  /** The row a roll landed on, and the die. */
  mark?: { key: string; roll: number }
  /** A long table sets its rows in two halves on a wide screen, ranges outside. */
  split?: boolean
}

type ColumnsTable = {
  kind: 'columns'
  columns: RollInstrumentColumn[]
  /** The column and the entry a pair of rolls landed on. */
  mark?: { column: string; entry: string }
}

export type RollTableInstrumentProps = {
  /** The table's name: the accessible name of its rows or grid. */
  name: string
  table: BandsTable | ColumnsTable
  size: CardSize
  /** The surface's tone (a CSS colour); its band paints every other row. */
  tone?: string
  /** The stamp's words: "Roll the Die:", or "Roll twice:" for two dice. */
  stamp?: string
  /** The bar's title, after the stamp (a card's table name). */
  title?: ReactNode
  /** A quieter line in the bar (the page's, which has no title there). */
  hint?: ReactNode
  /** The host's controls, at the bar's far end. */
  actions?: ReactNode
  /** Under the bar, above the bands: the host's result readout. */
  readout?: ReactNode
  /** Whether the bands show (a card folds them behind its Table toggle). */
  open?: boolean
  /** `box`: its own ink frame (a page, a guide step); `rule`: flush in a card. */
  frame?: 'box' | 'rule'
  density?: RollInstrumentDensity
}

/** The custom property the instrument carries its band in (`rollBandColor`). */
const BAND_VAR = '--su-roll-band'

/** Row `index`'s fill: paper, then the band, in turn; the rolled row is ink. */
const rowFill = (index: number, marked: boolean): CSSProperties => ({
  backgroundColor: marked
    ? 'var(--color-ink)'
    : index % 2 === 1
      ? `var(${BAND_VAR})`
      : 'var(--color-paper)',
})

export function RollTableInstrument({
  name,
  table,
  size,
  tone,
  stamp = 'Roll the Die:',
  title,
  hint,
  actions,
  readout,
  open = true,
  frame = 'box',
  density,
}: RollTableInstrumentProps) {
  return (
    <div
      className="su-roll"
      data-size={size}
      data-frame={frame}
      data-density={density}
      style={{ [BAND_VAR]: rollBandColor(tone) } as CSSProperties}
    >
      <div className="su-roll__bar">
        <span className="su-roll__stamp">{stamp}</span>
        {title && <span className="su-roll__title">{title}</span>}
        {hint && <span className="su-roll__hint">{hint}</span>}
        {actions}
      </div>
      {readout}
      {open &&
        (table.kind === 'bands' ? (
          <Bands name={name} table={table} />
        ) : (
          <Columns name={name} table={table} />
        ))}
    </div>
  )
}

function Bands({ name, table }: { name: string; table: BandsTable }) {
  const { rows, mark, split } = table
  const half = Math.ceil(rows.length / 2)
  const halves = split ? [rows.slice(0, half), rows.slice(half)] : [rows]
  return (
    <div className="su-roll__bands" data-split={halves.length > 1 ? 'true' : undefined}>
      {halves.map((part, side) => (
        <ol
          key={side === 0 ? 'left' : 'right'}
          className="su-roll__rows"
          aria-label={side === 0 ? `${name} table` : `${name} table, continued`}
          data-side={side === 1 ? 'right' : undefined}
        >
          {part.map((row, at) => {
            const marked = mark?.key === row.key
            return (
              <li
                key={row.key}
                className="su-roll__row"
                data-rolled={marked ? 'true' : undefined}
                aria-current={marked ? 'true' : undefined}
                // The banding runs on across the halves: a split table bands as one.
                style={rowFill(side * half + at, marked)}
              >
                <span className="su-roll__range">{rollRangeLabel(row.key)}</span>
                <div className="su-roll__body">
                  {(row.label || marked) && (
                    // The "Rolled" pennant rides the title line, so the text
                    // keeps the row's whole width on a phone.
                    <div className="su-roll__head">
                      {row.label ? <span className="su-roll__label">{row.label}</span> : <span />}
                      {marked && <span className="su-roll__tag">Rolled {mark.roll}</span>}
                    </div>
                  )}
                  <span className="su-roll__value">{row.value}</span>
                </div>
              </li>
            )
          })}
        </ol>
      ))}
    </div>
  )
}

function Columns({ name, table }: { name: string; table: ColumnsTable }) {
  const { columns, mark } = table
  // The entry numbers down the edges are the first column's, as the book prints them.
  const entryKeys = columns[0]?.entries.map((entry) => entry.key) ?? []
  return (
    <div className="su-roll__grid">
      <table className="su-roll__table">
        <caption className="su-sr-only">{name}</caption>
        <thead>
          <tr>
            <th scope="col" className="su-roll__edge">
              <span className="su-sr-only">Entry</span>
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="su-roll__col"
                data-rolled={mark?.column === column.key ? 'true' : undefined}
              >
                {rollRangeLabel(column.key)}
              </th>
            ))}
            <th scope="col" className="su-roll__edge">
              <span className="su-sr-only">Entry</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entryKeys.map((entryKey, row) => (
            <tr key={entryKey} style={rowFill(row, false)}>
              <th scope="row" className="su-roll__edge">
                {rollRangeLabel(entryKey)}
              </th>
              {columns.map((column) => {
                const entry = column.entries[row]
                const rolled = !!entry && mark?.column === column.key && mark.entry === entry.key
                return (
                  <td
                    key={column.key}
                    className="su-roll__cell"
                    data-rolled={rolled ? 'true' : undefined}
                    aria-current={rolled ? 'true' : undefined}
                  >
                    {entry?.value}
                  </td>
                )
              })}
              <td aria-hidden="true" className="su-roll__edge">
                {rollRangeLabel(entryKey)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
