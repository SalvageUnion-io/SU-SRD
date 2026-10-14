import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { SURefObjectTable } from 'salvageunion-reference'
import { plainTraitText, resultForColumnsTable, resultForTable } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking, weight } from '../../../design/tokens'
import { useEntitySurface } from '../../../entity/entitySurfaceContext'
import { dieForTable, rollD20 } from '../../../utils/dice'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { Button } from '../../atoms/Button'
import { digestColumnsTable, digestRollTable } from '../../compositions/digestRollTable'
import { RollTableInstrument } from '../../compositions/RollTableInstrument'
import { rollRangeLabel } from '../../compositions/rollTableBands'
import type { CardSize } from '../../containers/displayMode'

/** A roll on this table: the die and the row it landed on. */
export type CardRoll = { roll: number; key: string }

/** A pair of rolls on a columns table: where they landed, and the entry's die. */
type ColumnsRoll = { column: string; entry: string; roll: number; value: string }

const PAD_X: Record<CardSize, string> = { large: space[12], medium: space[8], small: space[8] }

const cond = (size: string, extra?: CSSProperties): CSSProperties => ({
  fontFamily: font.cond,
  fontSize: size,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.1,
  textTransform: 'uppercase',
  ...extra,
})

/** The Table toggle: the Roll button's type and height (`.su-roll__control`). */
const BAR_BUTTON = { flex: 'none' } satisfies CSSProperties

/** A row's text, its trait references as Mentions. */
function TraitText({ text }: { text: string }) {
  return <>{useParseTraitReferences(text)}</>
}

/**
 * An entity's own ROLL TABLE, inline in its card like an action (board E4):
 * the shared `RollTableInstrument`, with the card's controls in its bar and
 * its readout under it.
 *
 * Two switches — shown or hidden, rolled or not — give four states, and ONE
 * bar holds the same place in all of them: the table's name, the Table / Hide
 * toggle and, at the far right, the Roll the Die button (press it again to
 * reroll). Rolling never needs the table
 * open, so every table starts hidden, on the server as in the browser.
 *
 * The result is a READOUT, not a row hunt: the number, the outcome and its
 * text in an ink strip under the bar, at reading size, open or not. An open
 * table also marks the matching row, the instrument's mark: the same whatever
 * the outcome, so the web never colours a roll by how it went (ruleset §3.4).
 *
 * The rows are banded in the SURFACE TONE (`tone`: a guide's own colour, for
 * the tables in its steps), cream on a surface with none.
 *
 * A surface that announces rolls (`EntitySurfaceValue.announceRoll` — the
 * SRD's toast) gets the result there instead of the readout; the open table
 * still marks the row.
 *
 * A COLUMNS table (Callsign, a d20 × d20) is the same instrument and the same
 * bar: its Roll twice button rolls both dice, the readout names the column, and the grid marks
 * the column's head and the entry's cell.
 */
export function CardRollTable({
  table,
  name,
  size,
  disabled,
  defaultOpen = false,
  defaultRoll,
  framed = false,
  tone,
  onRollResult,
}: {
  table: SURefObjectTable
  /** The table's name, for the bar. */
  name: string
  size: CardSize
  /** A damaged host: the table reads, but there is no Roll. */
  disabled: boolean
  /** Start open (a story's fixed state). Every table starts hidden otherwise. */
  defaultOpen?: boolean
  /** Start rolled at this die (a story's fixed state, a restored roll). */
  defaultRoll?: number
  /**
   * Inside a padded body (a guide's step) the table wears its own ink frame;
   * flush in a card it is closed by the rule above its bar.
   */
  framed?: boolean
  /** The surface's tone (a CSS colour), whose band paints every other row. */
  tone?: string
  /** Called with the outcome's text (and its range key) on every roll. */
  onRollResult?: (text: string, key: string) => void
}) {
  const { announceRoll } = useEntitySurface()
  const [expanded, setExpanded] = useState(defaultOpen)
  const isColumns = table.type === 'columns'
  const [rolled, setRolled] = useState<CardRoll | null>(() =>
    defaultRoll != null && !isColumns
      ? { roll: defaultRoll, key: resultForTable(table, defaultRoll).key }
      : null
  )
  const [rolledColumns, setRolledColumns] = useState<ColumnsRoll | null>(null)

  const rows = isColumns ? [] : digestRollTable(table)
  const hit = rolled ? rows.find((row) => row.key === rolled.key) : undefined

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
      announceRoll?.({
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
    announceRoll?.({
      table: name,
      roll: entryRoll,
      range: `column ${rollRangeLabel(columnKey)}`,
      text: result.value,
    })
  }

  const actions = (
    <Button
      size="compact"
      className="su-roll__toggle su-roll__control"
      aria-expanded={expanded}
      aria-label={expanded ? `Hide the ${name} table` : `Show the ${name} table`}
      onClick={() => setExpanded((open) => !open)}
      style={BAR_BUTTON}
    >
      {expanded ? 'Hide' : 'Table'}
      {expanded ? (
        <ChevronUp aria-hidden="true" size={16} />
      ) : (
        <ChevronDown aria-hidden="true" size={16} />
      )}
    </Button>
  )

  // The live region is always mounted, so the announcement fires on the first
  // roll too. A surface that announces rolls shows its own.
  const readout = announceRoll ? null : (
    <div aria-live="polite">
      {rolled && hit && (
        <RollReadout
          roll={rolled.roll}
          where={`lands on ${rollRangeLabel(hit.key)}`}
          label={hit.label}
          text={<TraitText text={hit.value} />}
          size={size}
        />
      )}
      {rolledColumns && (
        <RollReadout
          roll={rolledColumns.roll}
          where={`column ${rollRangeLabel(rolledColumns.column)}`}
          label={rolledColumns.value}
          size={size}
        />
      )}
    </div>
  )

  return (
    <RollTableInstrument
      name={name}
      title={name}
      size={size}
      tone={tone}
      frame={framed ? 'box' : 'rule'}
      stamp={isColumns ? 'Roll twice:' : undefined}
      onRoll={disabled ? undefined : isColumns ? rollColumns : rollBands}
      actions={actions}
      readout={readout}
      open={expanded}
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

/** The result readout: the die, where it landed, the outcome and its text. */
function RollReadout({
  roll,
  where,
  label,
  text,
  size,
}: {
  roll: number
  /** Where the roll landed: "lands on 11–19", "column 9–12". */
  where: string
  label: string | null
  text?: ReactNode
  size: CardSize
}) {
  return (
    <div
      style={{
        alignItems: 'center',
        backgroundColor: 'var(--color-ink)',
        // Under the ink bar: a faint paper rule parts the two.
        borderTop: 'var(--bw-chrome) solid var(--color-paper-30)',
        color: 'var(--color-paper)',
        display: 'flex',
        gap: space[12],
        padding: `${space[8]} ${PAD_X[size]}`,
      }}
    >
      <span
        style={{
          backgroundColor: 'var(--color-paper)',
          color: color.ink,
          flex: 'none',
          fontFamily: font.cond,
          fontSize: size === 'small' ? fontSize.display : fontSize.hero,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: weight.extrabold,
          lineHeight: 1,
          minWidth: '2ch',
          padding: `${space[2]} ${space[8]} ${space[4]}`,
          textAlign: 'center',
        }}
      >
        {roll}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[2], minWidth: 0 }}>
        <span style={cond(fontSize.badge, { letterSpacing: tracking.capsSnug })}>
          You rolled · {where}
        </span>
        {label && (
          <span
            style={cond(size === 'small' ? fontSize.readout : fontSize.title, { lineHeight: 1 })}
          >
            {label}
          </span>
        )}
        {text && (
          <span
            style={{
              fontSize: size === 'small' ? fontSize.caption : fontSize.lede,
              lineHeight: 1.4,
            }}
          >
            {text}
          </span>
        )}
      </div>
    </div>
  )
}
