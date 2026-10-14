import type { RollTableType } from 'component-lib'
import {
  Badge,
  Button,
  cn,
  digestRollTable,
  FOCUS_RING_ON_TONE,
  RollStamp,
  revealRolled,
  Text,
  toast,
  useParseTraitReferences,
} from 'component-lib'
import {
  borderWidth,
  color,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from 'component-lib/design/tokens'
import { Copy } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SURefObjectTable, SURefObjectTableContent } from 'salvageunion-reference'
import { resultForColumnsTable, resultForTable } from 'salvageunion-reference'
import { dieForTable, rollD20 } from '../../lib/rollTableDice'

type ColumnsTableData = Extract<SURefObjectTable, { type: 'columns' }>

/*
 * Styling is tokens in style objects (ADR-046). The two
 * properties with a `:hover` — the title trigger's border and fill — live in
 * `.su-roll-table__title-select` (`styles/controls.css`), resting value included. `RollTable` takes no `className`, so no consumer override
 * has to survive here.
 */

/**
 * The inherited type rungs: a size AND its paired line height. Kept as
 * unitless ratios (not the px they resolve to), so a child that changes its
 * font size still inherits the same line-height factor.
 */
const TYPE = {
  xs: { fontSize: fontSize.xs, lineHeight: 'calc(1 / 0.75)' },
  sm: { fontSize: fontSize.sm, lineHeight: 'calc(1.25 / 0.875)' },
  base: { fontSize: fontSize.base, lineHeight: 'calc(1.5 / 1)' },
  lg: { fontSize: fontSize.lg, lineHeight: 'calc(1.75 / 1.125)' },
  '2xl': { fontSize: fontSize['2xl'], lineHeight: 'calc(2 / 1.5)' },
} as const satisfies Record<string, CSSProperties>

/** The standard transition easing. */
const EASE_DEFAULT = 'cubic-bezier(0.4, 0, 0.2, 1)'

const BOLD = { fontWeight: weight.bold } satisfies CSSProperties

/** The 2px pilot-light frame both variants draw round the band + rows. */
const FRAME_STYLE = {
  borderRadius: radius.card,
  border: `${borderWidth.pill} solid ${color.pilotLight}`,
} satisfies CSSProperties

const OUTER_STYLE = { position: 'relative', overflow: 'visible' } satisfies CSSProperties

const TABLE_STYLE = { width: '100%', borderCollapse: 'collapse' } satisfies CSSProperties

/** Codex `.a-rt` alternating full-row bands: tone tint / warm paper. */
const bandColor = (index: number) => (index % 2 === 0 ? color.pilotLight : color.bandCream)

/** Codex `.a-rt` row hairline. */
const ROW_RULE = `${borderWidth.hairline} solid ${color.ink10}`

/** The lifted, ink-shadowed look of the rolled row / cell. */
const LIFT_SHADOW = `0 14px 40px ${color.ink85}`

/**
 * Turns the header title into the surface's TABLE PICKER trigger.
 *
 * A surface that shows one of many tables (the Dashboard Tables view) carries
 * no separate bar above the table repeating the name the header band already
 * prints: the header title IS the trigger, one name, one control.
 *
 * Typed rather than a `node` slot, so the header keeps ownership of its own
 * affordance (chevron, hit area, focus ring, aria) and every consumer gets the
 * same one — the same reason entity-card interactivity is typed `controls`.
 * The caller still owns what opening means; it renders its own picker.
 */
type RollTableTitleSelect = {
  /** Open the caller's picker. */
  onOpen: () => void
  /** Whether that picker is currently open — drives `aria-expanded`. */
  open?: boolean
  /** Overrides the trigger's accessible name (default names the current table). */
  ariaLabel?: string
}

type RollTableDisplayProps = {
  table: RollTableType
  /**
   * Ladder rung (styles/sizing.ts) — two rungs: `full` (default) is the
   * reading table; `compact` tightens rows, result text and action chips for
   * dense listings / nested content.
   */
  size?: 'full' | 'compact'
  tableName?: string
  /** Called with the result text (and roll key) when the built-in roll button is used */
  onRollResult?: (text: string, key: string) => void
  /** Renders the header title as a picker trigger (see `RollTableTitleSelect`). */
  titleSelect?: RollTableTitleSelect
}

/*
 * The header band. Inline, so each property outranks the stamp's own geometry
 * (its inline-block fit-content width, the compact rung's padding, the
 * caps-tight tracking).
 */
const HEADER_BAND_STYLE = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[8],
  paddingInline: space[10],
  paddingBlock: space[6],
  letterSpacing: tracking.capsSnug,
} satisfies CSSProperties

const HEADER_TITLE_STYLE = {
  display: 'inline-flex',
  minWidth: 0,
  alignItems: 'center',
  gap: space[12],
} satisfies CSSProperties

const HEADER_ACTION_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: space[8],
} satisfies CSSProperties

/**
 * The roll-table header band — the ink bar carrying the table name and the
 * ROLL THE DIE stamp, which IS the roll (component-lib's `RollStamp`): there
 * is no second Roll button, and pressing the stamp again rolls again.
 *
 * StandardRollTable and ColumnsRollTable each held a VERBATIM 31-line copy of
 * this. Only the BAND was duplicated: the frames around it genuinely differ
 * (the columns variant adds `overflow-visible` and a fade transition), so
 * extracting the whole frame would not have been pixel-neutral. This is.
 */
function RollTableHeader({
  tableName,
  handleRoll,
  titleSelect,
}: {
  tableName?: string
  handleRoll: () => void
  titleSelect?: RollTableTitleSelect
}) {
  const title = tableName || 'Roll table'
  return (
    <Badge shape="stamp" as="div" size="compact" style={HEADER_BAND_STYLE}>
      <span style={HEADER_TITLE_STYLE}>
        {titleSelect ? <TitleSelect title={title} select={titleSelect} /> : title}
      </span>
      <span style={HEADER_ACTION_STYLE}>
        <RollStamp name={title} onRoll={handleRoll} onInk>
          Roll the Die
        </RollStamp>
      </span>
    </Badge>
  )
}

/** The title trigger's 10px caret — flipped when its picker is open. */
function Caret({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        transitionProperty: 'transform, translate, scale, rotate',
        transitionTimingFunction: EASE_DEFAULT,
        transitionDuration: '150ms',
        rotate: flipped ? '180deg' : undefined,
      }}
    >
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/**
 * Its border colour and fill change on hover, so they are
 * `.su-roll-table__title-select`; the focus ring is `FOCUS_RING_ON_TONE`'s.
 */
const TITLE_SELECT_STYLE = {
  display: 'inline-flex',
  minWidth: 0,
  cursor: 'pointer',
  alignItems: 'center',
  gap: space[6],
  borderRadius: radius.badge,
  borderWidth: borderWidth.hairline,
  borderStyle: 'solid',
  paddingInline: space[8],
  paddingBlock: space[2],
  textAlign: 'left',
  // `uppercase` is NOT redundant with the band: the UA reset gives
  // `button` its own `text-transform: none`, so without it the trigger
  // reads Title Case beside a band that is otherwise all caps.
  textTransform: 'uppercase',
  color: color.paper,
} satisfies CSSProperties

const TRUNCATE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

/**
 * The title-as-picker-trigger. Reads as the title it replaces (same band type),
 * with a hairline plate + caret marking it as choosable and the on-tone focus
 * ring — the paper-offset rung, because the rust ring would vanish on the ink
 * band this sits in.
 */
function TitleSelect({ title, select }: { title: string; select: RollTableTitleSelect }) {
  return (
    <button
      type="button"
      onClick={select.onOpen}
      aria-haspopup="dialog"
      aria-expanded={select.open ?? false}
      aria-label={select.ariaLabel ?? `Choose a roll table (current: ${title})`}
      className={cn('su-roll-table__title-select', FOCUS_RING_ON_TONE)}
      style={TITLE_SELECT_STYLE}
    >
      <span style={TRUNCATE}>{title}</span>
      <Caret flipped={select.open} />
    </button>
  )
}

function RollTableDescription({
  label,
  value,
  compact,
}: {
  label: string | null
  value: string
  compact?: boolean
}) {
  const parsed = useParseTraitReferences(value)
  return (
    <div style={{ color: color.ink, ...(compact ? TYPE.xs : TYPE.base) }}>
      {label && <span style={BOLD}>{label}: </span>}
      {parsed}
    </div>
  )
}

function ResultActionBar({ compact, resultText }: { compact?: boolean; resultText: string }) {
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      navigator.clipboard
        .writeText(resultText)
        .then(() => toast.success('Copied', { id: 'clipboard-copy', duration: 1500 }))
    },
    [resultText]
  )

  // Copy is the shared `Button` at its mini rung. There is no Reroll here:
  // the header's ROLL THE DIE stamp is the table's one roll control.
  const iconSize = compact ? 12 : 14

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '-26px',
        left: '50%',
        zIndex: 2,
        display: 'flex',
        translate: '-50% 0',
        alignItems: 'center',
        gap: compact ? space[2] : space[4],
      }}
    >
      <Button size="mini" onClick={handleCopy} aria-label="Copy result to clipboard">
        Copy
        <Copy aria-hidden="true" size={iconSize} />
      </Button>
    </div>
  )
}

/** The gap between a standard row's roll cell and its result. */
const rowGap = (compact?: boolean) => (compact ? space[4] : space[8])

/** Codex `.a-rt .band`: fixed 52px roll column, centred, with a right hairline. */
const rollCellStyle = (compact?: boolean) =>
  ({
    display: 'flex',
    width: '52px',
    flexShrink: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderRight: `${borderWidth.hairline} solid ${color.ink20}`,
    fontWeight: weight.normal,
    fontVariantNumeric: 'tabular-nums',
    paddingBlock: compact ? space[4] : space[8],
  }) satisfies CSSProperties

/**
 * The roll number. Line height is the size rung's own, deliberately NOT 1:
 * that is the rendered look, so don't set one.
 */
const rollKeyStyle = (compact?: boolean) =>
  ({
    whiteSpace: 'nowrap',
    textAlign: 'center',
    fontWeight: weight.bold,
    color: color.ink,
    ...(compact ? TYPE.sm : TYPE.lg),
  }) satisfies CSSProperties

const resultCellStyle = (compact?: boolean) =>
  ({
    display: 'flex',
    flex: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingBlock: compact ? space[2] : space[4],
  }) satisfies CSSProperties

const COLUMN_KEYS = ['1-4', '5-8', '9-12', '13-16', '17-20'] as const

type ColumnsRollResult = {
  columnKey: string
  entryKey: string
  value: string
}

function getColumnEntry(
  tableData: ColumnsTableData,
  colKey: (typeof COLUMN_KEYS)[number],
  entryNum: string
): SURefObjectTableContent | undefined {
  return tableData[colKey][entryNum as keyof ColumnsTableData['1-4']]
}

function ColumnsRollTable({
  size = 'full',
  table,
  tableName,
  onRollResult,
  titleSelect,
}: Omit<RollTableDisplayProps, 'table'> & { table: ColumnsTableData }) {
  const compact = size === 'compact'
  const [result, setResult] = useState<ColumnsRollResult | null>(null)
  const [rollAnnouncement, setRollAnnouncement] = useState('')
  const highlightedRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    if (result) revealRolled(highlightedRef.current)
  }, [result])

  const tableData = table

  const handleRoll = () => {
    setResult(null)
    setRollAnnouncement('')
    // Two plain d20s: a columns table is never a named Salvage Union table,
    // and @randsum/salvageunion's rollTable reads banded tables only.
    const colRoll = rollD20()
    const entryRoll = rollD20()
    const res = resultForColumnsTable(table, colRoll, entryRoll)
    setTimeout(() => {
      if (res.success) {
        setResult({
          columnKey: res.columnKey,
          entryKey: res.entryKey,
          value: res.result.value,
        })
        setRollAnnouncement(`Column ${res.columnKey}, Roll ${res.entryKey}: ${res.result.value}`)
        onRollResult?.(res.result.value, res.entryKey)
      }
    }, 300)
  }

  const handleClear = () => {
    setResult(null)
    setRollAnnouncement('')
  }

  return (
    <div style={OUTER_STYLE}>
      <div className="su-sr-only" aria-live="polite" role="status">
        {rollAnnouncement}
      </div>

      <div style={FRAME_STYLE}>
        <RollTableHeader tableName={tableName} handleRoll={handleRoll} titleSelect={titleSelect} />

        <div style={{ overflow: 'visible' }}>
          <table style={TABLE_STYLE}>
            <caption className="su-sr-only">{tableName || 'Columns roll table'}</caption>
            <thead>
              <tr>
                {COLUMN_KEYS.map((colKey) => (
                  <th
                    key={colKey}
                    scope="col"
                    style={{
                      textAlign: 'left',
                      fontWeight: weight.bold,
                      color: color.ink,
                      paddingInline: compact ? space[8] : space[12],
                      paddingBlock: compact ? space[4] : space[8],
                      ...(compact ? TYPE.lg : TYPE['2xl']),
                    }}
                  >
                    ({colKey.replace('-', ' - ')})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 20 }, (_, i) => {
                const entryNum = (i + 1).toString()
                return (
                  <tr
                    key={entryNum}
                    style={{ borderBottom: ROW_RULE, backgroundColor: bandColor(i) }}
                  >
                    {COLUMN_KEYS.map((colKey) => {
                      const entry = getColumnEntry(tableData, colKey, entryNum)
                      const isHighlighted =
                        result?.columnKey === colKey && result?.entryKey === entryNum

                      return (
                        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-selected marks the rolled result cell; restructuring the table to a grid role would change its announced semantics
                        <td
                          key={colKey + entryNum}
                          ref={isHighlighted ? highlightedRef : null}
                          style={{
                            position: 'relative',
                            textAlign: 'left',
                            color: color.ink,
                            transitionProperty: 'all',
                            transitionTimingFunction: EASE_DEFAULT,
                            transitionDuration: '200ms',
                            paddingInline: compact ? space[8] : space[12],
                            paddingBlock: compact ? space[2] : space[4],
                            ...(compact ? TYPE.xs : TYPE.base),
                            ...(isHighlighted && {
                              zIndex: 1,
                              scale: '1.04',
                              cursor: 'pointer',
                              outline: `4px solid ${color.ink}`,
                              boxShadow: LIFT_SHADOW,
                            }),
                          }}
                          onClick={isHighlighted ? handleClear : undefined}
                          onKeyDown={
                            isHighlighted
                              ? (e: React.KeyboardEvent) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    handleClear()
                                  }
                                }
                              : undefined
                          }
                          aria-selected={isHighlighted || undefined}
                          tabIndex={isHighlighted ? 0 : undefined}
                        >
                          <span style={BOLD}>{entryNum}:</span> {entry?.value}
                          {isHighlighted && (
                            <ResultActionBar compact={compact} resultText={entry?.value ?? ''} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function RollTable(props: RollTableDisplayProps) {
  // `type` is a discriminant: only the SURefObjectTable columns member carries
  // 'columns', so this narrowing is exactly `isColumnsTable`.
  const { table } = props
  if (table.type === 'columns') {
    return <ColumnsRollTable {...props} table={table} />
  }
  return <StandardRollTable {...props} />
}

function StandardRollTable({
  size = 'full',
  table,
  tableName,
  onRollResult,
  titleSelect,
}: RollTableDisplayProps) {
  const compact = size === 'compact'
  const digestedTable = digestRollTable(table)
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const [rollAnnouncement, setRollAnnouncement] = useState('')
  const highlightedRowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (highlightedKey) revealRolled(highlightedRowRef.current)
  }, [highlightedKey])

  const handleRoll = () => {
    setHighlightedKey(null)
    setRollAnnouncement('')
    // A named table rolls through @randsum/salvageunion (dieForTable); the row
    // is still read from this table's own data, by the same total.
    const die = tableName === undefined ? Promise.resolve(rollD20) : dieForTable(tableName)
    void die.then((d20) => {
      const { key } = resultForTable(table as SURefObjectTable, d20())
      setTimeout(() => {
        setHighlightedKey(key)
        const entry = digestedTable.find((d) => d.key === key)
        if (entry) {
          const text = entry.label ? `${entry.label}: ${entry.value}` : entry.value
          setRollAnnouncement(
            `Rolled ${key}: ${entry.label ? `${entry.label} - ` : ''}${entry.value}`
          )
          onRollResult?.(text, key)
        }
      }, 300)
    })
  }

  const handleClearHighlight = () => {
    setHighlightedKey(null)
    setRollAnnouncement('')
  }

  return (
    <div style={OUTER_STYLE}>
      {/* Screen reader announcement for roll results */}
      <div className="su-sr-only" aria-live="polite" role="status">
        {rollAnnouncement}
      </div>

      <div
        style={{
          ...FRAME_STYLE,
          overflow: 'visible',
          transitionProperty: 'opacity',
          transitionTimingFunction: EASE_DEFAULT,
          transitionDuration: '200ms',
        }}
      >
        <RollTableHeader tableName={tableName} handleRoll={handleRoll} titleSelect={titleSelect} />
        <table style={TABLE_STYLE}>
          <caption className="su-sr-only">{tableName || 'Roll table'}</caption>
          <thead className="su-sr-only">
            <tr>
              <th scope="col">Roll</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {digestedTable.map(({ label, value, key }, index) => {
              if (key === 'type') return null
              const isHighlighted = highlightedKey === key

              return (
                <tr
                  ref={isHighlighted ? highlightedRowRef : null}
                  key={key}
                  aria-selected={isHighlighted || undefined}
                  tabIndex={isHighlighted ? 0 : undefined}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    borderBottom: ROW_RULE,
                    transitionProperty: 'all',
                    transitionTimingFunction: EASE_DEFAULT,
                    transitionDuration: '200ms',
                    backgroundColor: bandColor(index),
                    gap: rowGap(compact),
                    ...(isHighlighted && {
                      zIndex: 1,
                      scale: '1.04',
                      cursor: 'pointer',
                      boxShadow: `0 0 0 4px ${color.ink85}, ${LIFT_SHADOW}`,
                    }),
                  }}
                  onClick={isHighlighted ? handleClearHighlight : undefined}
                  onKeyDown={
                    isHighlighted
                      ? (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleClearHighlight()
                          }
                        }
                      : undefined
                  }
                >
                  {isHighlighted && (
                    <td style={{ display: 'contents' }}>
                      <ResultActionBar
                        compact={compact}
                        resultText={label ? `${label}: ${value}` : value}
                      />
                    </td>
                  )}
                  <th scope="row" style={rollCellStyle(compact)}>
                    <Text style={rollKeyStyle(compact)}>{key}</Text>
                  </th>
                  <td style={resultCellStyle(compact)}>
                    <RollTableDescription label={label} value={value} compact={compact} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
