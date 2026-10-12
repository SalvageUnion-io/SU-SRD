import { Copy, X } from 'lucide-react'
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SURefObjectTable, SURefObjectTableContent } from 'salvageunion-reference'
import { resultForColumnsTable, resultForTable } from 'salvageunion-reference'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import type { SizeRung } from '../../styles/sizing'
import { cn } from '../../utils/cn'
import { d20ForTable, rollD20 } from '../../utils/dice'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { Text } from '../base/Text'
import { Badge } from '../chrome/Badge'
import { Button } from '../chrome/Button'
import { FOCUS_RING_ON_TONE } from '../chrome/interaction'
import { useCopyFeedback } from './copyFeedbackContext'
import type { RollTableType } from './digestRollTable'
import { digestRollTable } from './digestRollTable'

type ColumnsTableData = Extract<SURefObjectTable, { type: 'columns' }>

/*
 * Styling is tokens in style objects (Tailwind-removal plan §4). The three
 * properties with a `:hover` — the expand toggle's colour, the title trigger's
 * border and fill — live in `.su-roll-table__*` (styles/index.css), resting
 * value included. `RollTable` takes no `className`, so no consumer override
 * has to survive here.
 */

/**
 * Tailwind's inherited type rungs: a size AND its paired line height, which
 * `text-xs` … `text-2xl` set together. Kept as Tailwind's own unitless ratios
 * (not the px they resolve to), so a child that changes its font size still
 * inherits the same factor it did under the utility.
 */
const TYPE = {
  xs: { fontSize: fontSize.xs, lineHeight: 'calc(1 / 0.75)' },
  sm: { fontSize: fontSize.sm, lineHeight: 'calc(1.25 / 0.875)' },
  base: { fontSize: fontSize.base, lineHeight: 'calc(1.5 / 1)' },
  lg: { fontSize: fontSize.lg, lineHeight: 'calc(1.75 / 1.125)' },
  '2xl': { fontSize: fontSize['2xl'], lineHeight: 'calc(2 / 1.5)' },
} as const satisfies Record<string, CSSProperties>

/** Tailwind's default transition easing (`transition-*` with no `ease-*`). */
const EASE_DEFAULT = 'cubic-bezier(0.4, 0, 0.2, 1)'

const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: space[0],
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: space[0],
} satisfies CSSProperties

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
 * A surface that shows one of many tables (the Dashboard Tables view) used to
 * carry a separate bar above the table — a label, then a button repeating the
 * table's name, directly above the header band already printing that same name.
 * With this the header title IS the trigger: one name, one control.
 *
 * Typed rather than a `node` slot, so the header keeps ownership of its own
 * affordance (chevron, hit area, focus ring, aria) and every consumer gets the
 * same one — the same reason entity-card interactivity is typed `controls`.
 * The caller still owns what opening means; it renders its own picker.
 *
 * Independent of `disabled`, which suppresses the ROLL action only: choosing
 * which table to read is not rolling on it.
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
  showCommand?: boolean
  disabled?: boolean
  /**
   * Ladder rung (styles/sizing.ts) — two rungs: `full` (default) is the
   * reading table; `compact` tightens rows, result text and action chips for
   * dense listings / nested content.
   */
  size?: Extract<SizeRung, 'full' | 'compact'>
  tableName?: string
  /** Called with the result text (and roll key) when the built-in roll button is used */
  onRollResult?: (text: string, key: string) => void
  /**
   * Collapsible mode: the header (title + Roll button) is always shown, and the
   * table rows collapse behind a "Show/Hide table" toggle (rolling still works
   * from the header and auto-expands to reveal the result). Implies the header.
   */
  collapsible?: boolean
  /**
   * Renders the header title as a picker trigger (see `RollTableTitleSelect`).
   * Requires the header — pass `showCommand` or `collapsible`.
   */
  titleSelect?: RollTableTitleSelect
}

/*
 * The header band. Inline, so each property outranks the stamp's own geometry
 * classes it replaces (`inline-block w-fit`, the compact rung's padding, the
 * caps-tight tracking) — what the band's tailwind-merged `className` did before.
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

/** Widens the mini rung's 8px inline padding; inline beats `.su-btn--mini`. */
const ROLL_BUTTON_STYLE = { paddingInline: '11px' } satisfies CSSProperties

/**
 * The roll-table header band — the ink bar carrying the expand toggle, the
 * table name and the rust Roll button.
 *
 * StandardRollTable and ColumnsRollTable each held a VERBATIM 31-line copy of
 * this. Only the BAND was duplicated: the frames around it genuinely differ
 * (the columns variant adds `overflow-visible` and a fade transition), so
 * extracting the whole frame would not have been pixel-neutral. This is.
 */
function RollTableHeader({
  showHeader,
  collapsible,
  expanded,
  setExpanded,
  tableName,
  disabled,
  handleRoll,
  titleSelect,
}: {
  showHeader?: boolean
  collapsible?: boolean
  expanded: boolean
  setExpanded: Dispatch<SetStateAction<boolean>>
  tableName?: string
  disabled?: boolean
  handleRoll: () => void
  titleSelect?: RollTableTitleSelect
}) {
  if (!showHeader) return null
  const title = tableName || 'Roll table'
  return (
    <Badge shape="stamp" as="div" size="compact" style={HEADER_BAND_STYLE}>
      <span style={HEADER_TITLE_STYLE}>
        {collapsible && (
          <ExpandToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        )}
        {titleSelect ? <TitleSelect title={title} select={titleSelect} /> : title}
      </span>
      {!disabled && (
        <span style={HEADER_ACTION_STYLE}>
          Roll the Die
          <Button
            variant="primary"
            size="mini"
            onClick={handleRoll}
            style={ROLL_BUTTON_STYLE}
            aria-label="Roll on this table"
            title="Roll on this table"
          >
            Roll
            <DiceIcon compact />
          </Button>
        </span>
      )}
    </Badge>
  )
}

/** The 10px caret both header controls use — flipped when what it opens is open. */
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

/** Its colour (paper at 80%, full paper on hover) is `.su-roll-table__toggle`. */
const EXPAND_TOGGLE_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: space[4],
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tracking.capsTight,
} satisfies CSSProperties

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
 * The expand/collapse control shown in a collapsible roll-table header. It sits
 * on the ink band, so it takes the on-tone ring: the paper ring carries on ink.
 */
function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn('su-roll-table__toggle', FOCUS_RING_ON_TONE)}
      style={EXPAND_TOGGLE_STYLE}
    >
      {expanded ? 'Hide' : 'Show'}
      <Caret flipped={expanded} />
    </button>
  )
}

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

const DiceIcon = ({ compact }: { compact?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height={compact ? '14' : '16'}
    viewBox="0 -960 960 960"
    width={compact ? '14' : '16'}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M240-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm480 0q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-600q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z" />
  </svg>
)

function ResultActionBar({
  compact,
  resultText,
  onReroll,
  onClear,
}: {
  compact?: boolean
  resultText: string
  onReroll: () => void
  /** When provided, renders a Clear action that resets the current result. */
  onClear?: () => void
}) {
  const onCopied = useCopyFeedback()
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      navigator.clipboard.writeText(resultText).then(() => onCopied?.())
    },
    [resultText, onCopied]
  )

  const handleReroll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onReroll()
    },
    [onReroll]
  )

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClear?.()
    },
    [onClear]
  )

  // Copy / Reroll / Clear are the shared `Button` at its mini rung, so they
  // line up as equal-sized actions: Reroll is the roll (the rust primary, as on
  // the card's own Roll), Copy and Clear the paper default.
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
      <Button variant="primary" size="mini" onClick={handleReroll}>
        Reroll
        <DiceIcon compact={compact} />
      </Button>
      {onClear && (
        <Button size="mini" onClick={handleClear} aria-label="Clear result">
          Clear
          <X aria-hidden="true" size={iconSize} />
        </Button>
      )}
    </div>
  )
}

/**
 * The collapsed-table result slide-out. When a collapsible table is ROLLED
 * while collapsed, the full table stays hidden and only the rolled result
 * slides out from below the header — a genuine height reveal via the
 * grid-template-rows `0fr → 1fr` idiom (a child clipped by `overflow-hidden`),
 * so the panel animates to its natural height with no magic max-height.
 *
 * The `ResultActionBar` (Copy/Reroll/Clear) is a SIBLING of the clipped grid,
 * not a child, because it deliberately protrudes below its parent
 * (`bottom-[-26px]`) and would otherwise be clipped by the reveal's
 * `overflow-hidden`.
 *
 * `children` is the single rolled row, supplied by each variant so it MIRRORS
 * that variant's own expanded-row markup (the roll `#` cell + result text).
 */
function CollapsedResultSlideout({
  show,
  hasResult,
  resultText,
  compact,
  onReroll,
  onClear,
  children,
}: {
  show: boolean
  hasResult: boolean
  resultText: string
  compact?: boolean
  onReroll: () => void
  onClear: () => void
  children: ReactNode
}) {
  if (!show) return null
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'grid',
          overflow: 'hidden',
          transitionProperty: 'grid-template-rows',
          transitionDuration: '300ms',
          // Tailwind's `ease-out` rung.
          transitionTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          gridTemplateRows: hasResult ? '1fr' : '0fr',
        }}
      >
        <div style={{ minHeight: 0 }}>
          <div
            style={{
              borderTop: `${borderWidth.pill} solid ${color.pilotLight}`,
              backgroundColor: color.bandCream,
              paddingInline: compact ? space[8] : space[12],
              paddingBlock: compact ? space[6] : space[8],
            }}
          >
            {children}
          </div>
        </div>
      </div>
      {hasResult && (
        <ResultActionBar
          compact={compact}
          resultText={resultText}
          onReroll={onReroll}
          onClear={onClear}
        />
      )}
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
 * The roll number. Line height is the size rung's own, NOT 1: the class list
 * this replaces carried `leading-none`, but `cn()` dropped it in favour of the
 * `text-sm` / `text-lg` that followed (tailwind-merge treats a font-size
 * utility as resetting the line height), so the rendered number never had it.
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
  disabled,
  table,
  showCommand = false,
  tableName,
  onRollResult,
  collapsible = false,
  titleSelect,
}: Omit<RollTableDisplayProps, 'table'> & { table: ColumnsTableData }) {
  const compact = size === 'compact'
  const [result, setResult] = useState<ColumnsRollResult | null>(null)
  const [rollAnnouncement, setRollAnnouncement] = useState('')
  const [expanded, setExpanded] = useState(!collapsible)
  const highlightedRef = useRef<HTMLTableCellElement>(null)
  const showHeader = showCommand || collapsible

  useEffect(() => {
    if (result && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
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
      <div style={VISUALLY_HIDDEN} aria-live="assertive" role="status">
        {rollAnnouncement}
      </div>

      <div style={FRAME_STYLE}>
        <RollTableHeader
          showHeader={showHeader}
          collapsible={collapsible}
          expanded={expanded}
          setExpanded={setExpanded}
          tableName={tableName}
          disabled={disabled}
          handleRoll={handleRoll}
          titleSelect={titleSelect}
        />

        <CollapsedResultSlideout
          show={collapsible && !expanded}
          hasResult={!!result}
          resultText={result?.value ?? ''}
          compact={compact}
          onReroll={handleRoll}
          onClear={handleClear}
        >
          {/* Mirror the expanded cell: bold roll `#` then the result text. */}
          <div style={{ textAlign: 'left', color: color.ink, ...(compact ? TYPE.xs : TYPE.base) }}>
            <span style={BOLD}>{result?.entryKey}:</span> {result?.value}
          </div>
        </CollapsedResultSlideout>

        {expanded && (
          <div style={{ overflow: 'visible' }}>
            <table style={TABLE_STYLE}>
              <caption style={VISUALLY_HIDDEN}>{tableName || 'Columns roll table'}</caption>
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
                              <ResultActionBar
                                compact={compact}
                                resultText={entry?.value ?? ''}
                                onReroll={handleRoll}
                              />
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
        )}
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
  disabled,
  table,
  showCommand = false,
  tableName,
  onRollResult,
  collapsible = false,
  titleSelect,
}: RollTableDisplayProps) {
  const compact = size === 'compact'
  const digestedTable = digestRollTable(table)
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const [rollAnnouncement, setRollAnnouncement] = useState('')
  const [expanded, setExpanded] = useState(!collapsible)
  const highlightedRowRef = useRef<HTMLTableRowElement>(null)
  const showHeader = showCommand || collapsible

  useEffect(() => {
    if (highlightedKey && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedKey])

  const handleRoll = () => {
    setHighlightedKey(null)
    setRollAnnouncement('')
    // A named table rolls through @randsum/salvageunion (d20ForTable); the row
    // is still read from this table's own data, by the same total.
    const die = tableName === undefined ? Promise.resolve(rollD20) : d20ForTable(tableName)
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

  const highlightedEntry = highlightedKey
    ? digestedTable.find((d) => d.key === highlightedKey)
    : undefined
  const collapsedResultText = highlightedEntry
    ? highlightedEntry.label
      ? `${highlightedEntry.label}: ${highlightedEntry.value}`
      : highlightedEntry.value
    : ''

  return (
    <div style={OUTER_STYLE}>
      {/* Screen reader announcement for roll results */}
      <div style={VISUALLY_HIDDEN} aria-live="assertive" role="status">
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
        <RollTableHeader
          showHeader={showHeader}
          collapsible={collapsible}
          expanded={expanded}
          setExpanded={setExpanded}
          tableName={tableName}
          disabled={disabled}
          handleRoll={handleRoll}
          titleSelect={titleSelect}
        />
        <CollapsedResultSlideout
          show={collapsible && !expanded}
          hasResult={!!highlightedEntry}
          resultText={collapsedResultText}
          compact={compact}
          onReroll={handleRoll}
          onClear={handleClearHighlight}
        >
          {/* Mirror the expanded row: the 52px roll `#` cell + the description. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: rowGap(compact),
            }}
          >
            <div style={rollCellStyle(compact)}>
              <Text style={rollKeyStyle(compact)}>{highlightedEntry?.key}</Text>
            </div>
            <div style={resultCellStyle(compact)}>
              <RollTableDescription
                label={highlightedEntry?.label ?? null}
                value={highlightedEntry?.value ?? ''}
                compact={compact}
              />
            </div>
          </div>
        </CollapsedResultSlideout>
        {expanded && (
          <table style={TABLE_STYLE}>
            <caption style={VISUALLY_HIDDEN}>{tableName || 'Roll table'}</caption>
            <thead style={VISUALLY_HIDDEN}>
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
                          onReroll={handleRoll}
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
        )}
      </div>
    </div>
  )
}
