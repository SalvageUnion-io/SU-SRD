import { ChevronDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { cn } from '../../lib/cn'
import { revealRolled } from '../../lib/revealRolled'
import { Button } from '../atoms/Button'
import { FOCUS_RING_ON_TONE } from '../atoms/interaction'
import type { CardSize } from '../containers/displayMode'
import { rollBandColor, rollRangeLabel } from './rollTableBands'

/**
 * RollTableInstrument — THE roll table, wherever one is drawn (EDL E14,
 * ruleset §2 "RollTable banded d20"): an entity card's own table, a guide
 * step's, and the SRD's roll-table page all draw this, so they cannot drift.
 * The book prints one table, however it is reached (pp. 88, 232).
 *
 * - The BAR: the table's title or a hint, then whatever controls the host
 *   owns (`actions`: a card's Table / Hide), then, at the far right, the ROLL
 *   (`RollControl`): given `onRoll` it is the table's one roll control, the
 *   shared `Button` reading "Roll the Die"; without it, or in static HTML
 *   before the script runs, it is the underlined "ROLL THE DIE:" stamp in the
 *   same place. No host draws a second Roll button beside it.
 *   The bar is an ink HEAD; with nothing of the host's in it (a page's
 *   bands) it labels the columns, d20 over the ranges and Result over the text.
 * - No readout: every roll's result is a toast (`toastRoll`), raised by the
 *   host; the table only marks where the roll landed, and a Roll on an open
 *   table brings the marked row (or cell) on screen (`revealRolled`).
 * - The BANDS: banded d20 rows in the SURFACE TONE (`tone`, the colour of the
 *   page or guide the table sits on): paper, then the tone's band
 *   (`rollBandColor`), in turn; a surface with no tone bands in cream. The
 *   rolled row is set in ink with a "Rolled N" pennant pinned to its top right
 *   corner, over the row rather than in its flow, so rolling never changes the
 *   row's height; the same mark whatever the outcome (ruleset §3.4). The other
 *   rows keep their ink, so every band reads at full contrast.
 * - A host that shows one of many tables (The Cantina's Dashboard Tables tab) makes
 *   the bar's title its PICKER (`titleSelect`): the title IS the trigger, one
 *   name, one control, with no second bar repeating it. The host owns what
 *   opening means and renders its own picker.
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

/**
 * The bar's title as the trigger of the host's table picker. Typed rather than
 * a `title` node, so the bar keeps its own affordance (chevron, hit area,
 * focus ring, aria) and every host gets the same one.
 */
export type RollTableTitleSelect = {
  /** Open the host's picker. */
  onOpen: () => void
  /** Whether that picker is open: drives `aria-expanded` and the chevron. */
  open?: boolean
  /** The trigger's accessible name (default: names the current table). */
  ariaLabel?: string
}

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
  /** The roll's words: "Roll the Die:", or "Roll twice:" for two dice. */
  stamp?: string
  /**
   * Roll the table: makes the roll control a button. Absent where the table
   * only reads (a static page, a damaged host, a surface with no rolls).
   */
  onRoll?: () => void
  /** The bar's title (a card's table name). */
  title?: ReactNode
  /** Makes the title the trigger of the host's table picker (`RollTableTitleSelect`). */
  titleSelect?: RollTableTitleSelect
  /** A quieter line in the bar (the page's, which has no title there). */
  hint?: ReactNode
  /** The host's controls, before the roll at the bar's far end. */
  actions?: ReactNode
  /** Whether the bands show (a card folds them behind its Table toggle). */
  open?: boolean
  /** The bands' DOM id: what that toggle's `aria-controls` names. */
  panelId?: string
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
  onRoll,
  title,
  titleSelect,
  hint,
  actions,
  open = true,
  panelId,
  frame = 'box',
  density,
}: RollTableInstrumentProps) {
  const root = useRef<HTMLDivElement>(null)
  // A Roll on an open table notes the mark it leaves; the first render that
  // marks anew reveals it. The host may mark later (its die loads first), and
  // may re-render before then, so the old mark is never what is revealed.
  const reveal = useRef<{ before: string } | null>(null)
  const marked = () => root.current?.querySelector('[aria-current="true"]')
  // A row's text carries its pennant, "Rolled N", so a new roll reads anew.
  const markOf = (at: Element | null | undefined) => at?.textContent ?? ''
  useEffect(() => {
    if (!reveal.current) return
    const rolled = marked()
    if (!rolled || markOf(rolled) === reveal.current.before) return
    reveal.current = null
    revealRolled(rolled)
  })
  const rollAndReveal = onRoll
    ? () => {
        reveal.current = open ? { before: markOf(marked()) } : null
        onRoll()
      }
    : undefined
  const roll = (
    <RollControl name={name} onRoll={rollAndReveal}>
      {stamp}
    </RollControl>
  )
  // A bar with nothing of the host's in it (a page's table) labels the bands' columns.
  const labelled = table.kind === 'bands' && !title && !titleSelect && !hint && !actions
  const split = table.kind === 'bands' && !!table.split
  return (
    <div
      ref={root}
      className="su-roll"
      data-size={size}
      data-frame={frame}
      data-density={density}
      style={{ [BAND_VAR]: rollBandColor(tone) } as CSSProperties}
    >
      {labelled ? (
        <div className="su-roll__bar" data-cols="true" data-split={split ? 'true' : undefined}>
          <span className="su-roll__cols" aria-hidden="true">
            <span className="su-roll__col-range">d20</span>
            <span className="su-roll__col-text">Result</span>
          </span>
          <span className="su-roll__cols su-roll__cols--end">
            {split && (
              <span className="su-roll__col-text su-roll__col-text--half" aria-hidden="true">
                Result
              </span>
            )}
            {roll}
          </span>
        </div>
      ) : (
        <div className="su-roll__bar">
          {titleSelect ? (
            <TitleSelect title={title ?? name} select={titleSelect} />
          ) : (
            title && <span className="su-roll__title">{title}</span>
          )}
          {hint && <span className="su-roll__hint">{hint}</span>}
          {actions}
          {roll}
        </div>
      )}
      {open &&
        (table.kind === 'bands' ? (
          <Bands id={panelId} name={name} table={table} />
        ) : (
          <Columns id={panelId} name={name} table={table} />
        ))}
    </div>
  )
}

/**
 * The title as the picker's trigger: the title's own type, a hairline paper
 * plate and a chevron marking it choosable, and the on-tone focus ring (the
 * rust ring would vanish on the ink bar). It wraps like the title (E18).
 */
function TitleSelect({ title, select }: { title: ReactNode; select: RollTableTitleSelect }) {
  const named = typeof title === 'string' ? title : undefined
  return (
    <span className="su-roll__title">
      <button
        type="button"
        className={cn('su-roll__title-select', FOCUS_RING_ON_TONE)}
        onClick={select.onOpen}
        aria-haspopup="dialog"
        aria-expanded={select.open ?? false}
        aria-label={
          select.ariaLabel ??
          (named ? `Choose a roll table (current: ${named})` : 'Choose a roll table')
        }
      >
        <span>{title}</span>
        <ChevronDown
          aria-hidden="true"
          size={14}
          className="su-roll__title-chevron"
          data-open={select.open ? 'true' : undefined}
        />
      </button>
    </span>
  )
}

/** Liveness never changes once true, so there is nothing to subscribe to. */
const noSubscribe = () => () => undefined

/**
 * Whether this render is in a browser that has run the script: false in
 * server markup (and the hydration pass that matches it), true after. A
 * control rendered as a button before its handler can run is a dead button.
 */
function useLive(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  )
}

/** "Roll the Die:" → the button's name, "Roll the die on Critical Damage" (WCAG 2.5.3). */
function rollLabel(words: string, name: string): string {
  const said = words.replace(/:\s*$/, '').toLowerCase()
  return `${said.charAt(0).toUpperCase()}${said.slice(1)} on ${name}`
}

/**
 * The instrument's roll, at the bar's far right: with `onRoll`, once the
 * script runs, the shared `Button` ("Roll the Die" in the action colour, named "Roll the die on
 * <table>"); otherwise (no roll here, or static HTML) the plain stamp, in the
 * same place. The host owns the result and its polite live region.
 */
export function RollControl({
  name,
  onRoll,
  children,
  size = 'compact',
}: {
  name: string
  onRoll?: () => void
  children: string
  /** `mini` inside a Token's strip (C1a), at the Token's height. */
  size?: 'compact' | 'mini'
}) {
  const live = useLive()
  if (!onRoll || !live) return <span className="su-roll__stamp su-roll__roll">{children}</span>
  return (
    <Button
      variant="primary"
      size={size}
      className={size === 'mini' ? 'su-roll__roll' : 'su-roll__roll su-roll__control'}
      onClick={onRoll}
      aria-label={rollLabel(children, name)}
    >
      {children.replace(/:\s*$/, '')}
    </Button>
  )
}

function Bands({ id, name, table }: { id?: string; name: string; table: BandsTable }) {
  const { rows, mark, split } = table
  const half = Math.ceil(rows.length / 2)
  const halves = split ? [rows.slice(0, half), rows.slice(half)] : [rows]
  return (
    <div
      id={id}
      className="su-roll__bands"
      data-split={halves.length > 1 ? 'true' : undefined}
      // The halves share one row track per pair (`grid-template-rows: subgrid`),
      // so row N on the left and row N on the right are always one height.
      style={halves.length > 1 ? ({ '--su-roll-half': half } as CSSProperties) : undefined}
    >
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
                // The second half bands one step off the first, so the rows
                // side by side never share a fill.
                style={rowFill(at + side, marked)}
              >
                <span className="su-roll__range">{rollRangeLabel(row.key)}</span>
                <div className="su-roll__body">
                  {row.label && (
                    <div className="su-roll__head">
                      <span className="su-roll__label">{row.label}</span>
                    </div>
                  )}
                  <span className="su-roll__value">{row.value}</span>
                  {/* Pinned to the corner, out of the flow: the row keeps its height. */}
                  {marked && <span className="su-roll__tag">Rolled {mark.roll}</span>}
                </div>
              </li>
            )
          })}
        </ol>
      ))}
    </div>
  )
}

function Columns({ id, name, table }: { id?: string; name: string; table: ColumnsTable }) {
  const { columns, mark } = table
  // The entry numbers down the edges are the first column's, as the book prints them.
  const entryKeys = columns[0]?.entries.map((entry) => entry.key) ?? []
  return (
    <div id={id} className="su-roll__grid">
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
