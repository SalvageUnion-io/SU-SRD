import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { SURefObjectTable } from 'salvageunion-reference'
import { resultForTable } from 'salvageunion-reference'
import { rollDie } from 'salvageunion-reference/rules'
import { color, font, fontSize, space, tracking, weight } from '../../../design/tokens'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { Button } from '../../chrome/Button'
import type { DigestedRollTable } from '../../shared/digestRollTable'
import { digestRollTable } from '../../shared/digestRollTable'
import type { CardSize } from '../../shared/displayMode'
import { RollTable } from '../../shared/RollTable'

/** A roll on this table: the die and the row it landed on. */
export type CardRoll = { roll: number; key: string }

const PAD_X: Record<CardSize, string> = { large: space[14], medium: space[10], small: space[8] }

const cond = (size: string, extra?: CSSProperties): CSSProperties => ({
  fontFamily: font.cond,
  fontSize: size,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.1,
  textTransform: 'uppercase',
  ...extra,
})

/** Roll and the Table toggle: condensed caps at the 44px touch floor (§4.6). */
const BAR_BUTTON: CSSProperties = {
  flex: 'none',
  fontFamily: font.cond,
  fontSize: fontSize.sm,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsSnug,
  minHeight: '44px',
  textTransform: 'uppercase',
}

const truncate: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

/** A range key as the book prints it: "11–19", with an en dash. */
const rangeLabel = (key: string) => key.replace('-', '–')

/**
 * An entity's own ROLL TABLE, inline in its card like an action (board E4).
 *
 * Two switches — shown or hidden, rolled or not — give four states, and ONE
 * bar holds the same place in all of them: the underlined "ROLL THE DIE:"
 * stamp, the table's name, Roll (Reroll once rolled) and the Table / Hide
 * toggle. Rolling never needs the table open.
 *
 * The result is a READOUT, not a row hunt: the number, the outcome and its
 * text in an ink strip under the bar, at reading size, open or not. An open
 * table also marks the matching row — the rules blue, an ink range cell and a
 * "Rolled" tag — and fades the rest. The mark is the same whatever the
 * outcome, so the web never colours a roll by how it went (ruleset §3.4).
 *
 * A COLUMNS table (a d20 × d20 grid) keeps the shared `RollTable`: its two
 * dice and five columns are a different shape from a banded table.
 */
export function CardRollTable({
  table,
  name,
  size,
  collapsible,
  disabled,
  defaultRoll,
  framed = false,
  onRollResult,
}: {
  table: SURefObjectTable
  /** The table's name, for the bar. */
  name: string
  size: CardSize
  /** Starts hidden (a nested card, a catalog tile); otherwise open. */
  collapsible: boolean
  /** A damaged host: the table reads, but there is no Roll. */
  disabled: boolean
  /** Start rolled at this die (a story's fixed state, a restored roll). */
  defaultRoll?: number
  /**
   * Inside a padded body (a guide's step) the table wears its own ink frame;
   * flush in a card it is closed by the rule above its bar.
   */
  framed?: boolean
  /** Called with the outcome's text (and its range key) on every roll. */
  onRollResult?: (text: string, key: string) => void
}) {
  const [expanded, setExpanded] = useState(!collapsible)
  const [rolled, setRolled] = useState<CardRoll | null>(() =>
    defaultRoll != null ? { roll: defaultRoll, key: resultForTable(table, defaultRoll).key } : null
  )

  if (table.type === 'columns') {
    return (
      <div style={{ padding: framed ? 0 : `${space[8]} ${PAD_X[size]}` }}>
        <RollTable
          table={table}
          showCommand
          size={size === 'large' ? 'full' : 'compact'}
          collapsible={collapsible}
          disabled={disabled}
        />
      </div>
    )
  }

  const rows = digestRollTable(table)
  const hit = rolled ? rows.find((row) => row.key === rolled.key) : undefined
  const roll = () => {
    const die = rollDie(20)
    const { key } = resultForTable(table, die)
    setRolled({ roll: die, key })
    const entry = rows.find((row) => row.key === key)
    if (entry) onRollResult?.(entry.label ? `${entry.label}: ${entry.value}` : entry.value, key)
  }

  return (
    <div
      style={
        framed
          ? {
              border: 'var(--bw-chrome) solid var(--color-ink)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
            }
          : { borderTop: 'var(--bw-chrome) solid var(--color-ink)' }
      }
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: `${space[8]} ${space[10]}`,
          padding: `${space[8]} ${PAD_X[size]}`,
        }}
      >
        <span
          style={cond(fontSize.caption, {
            backgroundColor: 'var(--color-ink)',
            color: 'var(--color-paper)',
            flex: 'none',
            padding: `3px ${space[6]}`,
            textDecoration: 'underline',
            whiteSpace: 'nowrap',
          })}
        >
          Roll the Die:
        </span>
        <span
          style={cond(size === 'small' ? fontSize.lede : fontSize.readout, {
            ...truncate,
            flex: '1 1 8rem',
          })}
        >
          {name}
        </span>
        {!disabled && (
          <Button
            variant="primary"
            size="compact"
            onClick={roll}
            // The name starts with the visible word (WCAG 2.5.3).
            aria-label={`${rolled ? 'Reroll' : 'Roll'} on this table`}
            style={BAR_BUTTON}
          >
            {rolled ? 'Reroll' : 'Roll'}
          </Button>
        )}
        <Button
          size="compact"
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
      </div>

      {/* The live region is always mounted, so the announcement fires on the
          first roll too. */}
      <div aria-live="polite">
        {rolled && hit && <RollReadout rolled={rolled} hit={hit} size={size} />}
      </div>

      {expanded && (
        <ol
          style={{
            display: 'flex',
            flexDirection: 'column',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {rows.map((row) => (
            <RollRow
              key={row.key}
              row={row}
              size={size}
              rolled={rolled && row.key === rolled.key ? rolled.roll : undefined}
              faded={!!rolled && row.key !== rolled.key}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

/** The result readout: the die, where it landed, the outcome and its text. */
function RollReadout({
  rolled,
  hit,
  size,
}: {
  rolled: CardRoll
  hit: DigestedRollTable
  size: CardSize
}) {
  const text = useParseTraitReferences(hit.value)
  return (
    <div
      style={{
        alignItems: 'center',
        backgroundColor: 'var(--color-ink)',
        borderTop: 'var(--bw-chrome) solid var(--color-ink)',
        color: 'var(--color-paper)',
        display: 'flex',
        gap: space[14],
        padding: `${space[10]} ${PAD_X[size]}`,
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
        {rolled.roll}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[2], minWidth: 0 }}>
        <span style={cond(fontSize.badge, { letterSpacing: tracking.capsSnug })}>
          You rolled · lands on {rangeLabel(hit.key)}
        </span>
        {hit.label && (
          <span
            style={cond(size === 'small' ? fontSize.readout : fontSize.title, { lineHeight: 1 })}
          >
            {hit.label}
          </span>
        )}
        <span
          style={{ fontSize: size === 'small' ? fontSize.caption : fontSize.lede, lineHeight: 1.4 }}
        >
          {text}
        </span>
      </div>
    </div>
  )
}

/** One banded row: the range cell, then the outcome and its text. */
function RollRow({
  row,
  size,
  rolled,
  faded,
}: {
  row: DigestedRollTable
  size: CardSize
  /** The die, when this is the row it landed on. */
  rolled: number | undefined
  faded: boolean
}) {
  const text = useParseTraitReferences(row.value)
  const marked = rolled != null
  return (
    <li
      aria-current={marked ? 'true' : undefined}
      style={{
        alignItems: 'stretch',
        backgroundColor: marked ? 'var(--color-wk-line)' : 'var(--color-paper)',
        borderTop: 'var(--bw-hairline) solid var(--color-ink-20)',
        display: 'flex',
      }}
    >
      <span
        style={cond(fontSize.readout, {
          alignItems: 'center',
          backgroundColor: marked ? 'var(--color-ink)' : 'var(--color-wk-bg)',
          borderRight: 'var(--bw-chrome) solid var(--color-ink)',
          color: marked ? 'var(--color-paper)' : color.ink,
          display: 'flex',
          flex: 'none',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: weight.extrabold,
          justifyContent: 'center',
          width: size === 'small' ? '48px' : '64px',
        })}
      >
        {rangeLabel(row.key)}
      </span>
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          gap: space[2],
          minWidth: 0,
          opacity: faded ? 0.6 : 1,
          padding: `${space[8]} ${space[12]}`,
        }}
      >
        {row.label && (
          <span style={cond(size === 'small' ? fontSize.lede : fontSize.readout)}>{row.label}</span>
        )}
        <span style={{ fontSize: size === 'small' ? fontSize.xs : fontSize.sm, lineHeight: 1.45 }}>
          {text}
        </span>
      </div>
      {marked && (
        <span
          style={cond(fontSize.caption, {
            alignSelf: 'center',
            backgroundColor: 'var(--color-ink)',
            clipPath: 'polygon(18% 0, 100% 0, 100% 100%, 18% 100%, 0 50%)',
            color: 'var(--color-paper)',
            flex: 'none',
            fontWeight: weight.extrabold,
            marginRight: space[10],
            padding: `3px ${space[6]} 3px ${space[14]}`,
            whiteSpace: 'nowrap',
          })}
        >
          Rolled {rolled}
        </span>
      )}
    </li>
  )
}
