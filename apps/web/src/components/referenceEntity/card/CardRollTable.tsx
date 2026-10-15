import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { RefObjectTable } from 'salvageunion-reference'
import { plainTraitText, resultForColumnsTable, resultForTable } from 'salvageunion-reference'
import { dieForTable, rollD20 } from '../../../lib/dice'
import { useParseTraitReferences } from '../../../lib/parseTraitReferences'
import { useDisclosure } from '../../../lib/useDisclosure'
import { Button } from '../../atoms/Button'
import { digestColumnsTable, digestRollTable } from '../../compositions/digestRollTable'
import { RollControl, RollTableInstrument } from '../../compositions/RollTableInstrument'
import { rollRangeLabel } from '../../compositions/rollTableBands'
import type { CardSize } from '../../containers/displayMode'
import { toastRoll } from '../../containers/toastRoll'

/** A roll on this table: the die and the row it landed on. */
export type CardRoll = { roll: number; key: string }

/** A pair of rolls on a columns table: where they landed, and the entry's die. */
type ColumnsRoll = { column: string; entry: string; roll: number; value: string }

/** The Table toggle: the Roll button's type and height (`.su-roll__control`). */
const BAR_BUTTON = { flex: 'none' } satisfies CSSProperties

/** The folded nested table's pill: ink, a thing you do, as an action's Token. */
const TOKEN_PILL = {
  backgroundColor: 'var(--color-ink)',
  color: 'var(--color-paper)',
} satisfies CSSProperties

/** A row's text, its trait references as Mentions. */
function TraitText({ text }: { text: string }) {
  return <>{useParseTraitReferences(text)}</>
}

/**
 * An entity's own ROLL TABLE, inline in its card like an action (board E4):
 * the shared `RollTableInstrument`, with the card's controls in its bar.
 *
 * Shown or hidden, rolled or not, ONE bar holds the same place: the table's
 * name, the Table / Hide toggle and, at the far right, the Roll the Die button
 * (press it again to reroll). Rolling never needs the table open, so every
 * table starts hidden, on the server as in the browser.
 *
 * The result is a TOAST (`toastRoll`), as every roll's is: the number, the
 * range it lands on, the outcome and its text, open or not. An open table also
 * marks the matching row, the instrument's mark: the same whatever the
 * outcome, so the web never colours a roll by how it went (ruleset §3.4).
 *
 * The rows are banded in the SURFACE TONE (`tone`: a guide's own colour, for
 * the tables in its steps), cream on a surface with none.
 *
 * A COLUMNS table (Callsign, a d20 × d20) is the same instrument and the same
 * bar: its Roll twice button rolls both dice, the toast names the column, and
 * the grid marks the column's head and the entry's cell.
 *
 * NESTED in another card (`nested`), the folded table is a TOKEN (owner's
 * call, 2026-10-14): the ink pill with its name on the cut-out, at a Token's
 * height, its Table and Roll buttons on the line beside it
 * (`.su-entity-token-line`). Table reveals the whole instrument in its place.
 */
export function CardRollTable({
  table,
  name,
  size,
  disabled,
  defaultOpen = false,
  defaultRoll,
  framed = false,
  nested = false,
  tone,
  onRollResult,
}: {
  table: RefObjectTable
  /** The table's name, for the bar. */
  name: string
  size: CardSize
  /** A damaged host: the table reads, but there is no Roll. */
  disabled: boolean
  /** Start open. Every table starts hidden otherwise. */
  defaultOpen?: boolean
  /** Start rolled at this die (a restored roll). */
  defaultRoll?: number
  /**
   * Inside a padded body (a guide's step) the table wears its own ink frame;
   * flush in a card it is closed by the rule above its bar.
   */
  framed?: boolean
  /** Inside another card: folded, the table is a Token with its buttons beside it. */
  nested?: boolean
  /** The surface's tone (a CSS colour), whose band paints every other row. */
  tone?: string
  /** Called with the outcome's text (and its range key) on every roll. */
  onRollResult?: (text: string, key: string) => void
}) {
  const fold = useDisclosure(defaultOpen)
  const expanded = fold.open
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

  const actions = (
    <Button
      size="compact"
      className="su-roll__toggle su-roll__control"
      {...fold.toggleProps}
      aria-label={expanded ? `Hide the ${name} table` : `Show the ${name} table`}
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

  if (nested && !expanded) {
    return (
      <div className="su-entity-token-line su-roll-token">
        <span className="su-entity-token">
          <span className="su-entity-token__pill" style={TOKEN_PILL}>
            <span className="su-entity-token__notch">
              <span className="su-entity-token__name">
                {name}
                <span className="su-sr-only"> (roll table)</span>
              </span>
            </span>
          </span>
        </span>
        {actions}
        <RollControl
          name={name}
          onRoll={disabled ? undefined : isColumns ? rollColumns : rollBands}
        >
          {isColumns ? 'Roll twice:' : 'Roll the Die:'}
        </RollControl>
      </div>
    )
  }

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
      open={expanded}
      panelId={fold.panelId}
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
