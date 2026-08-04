import { useState, useRef, useEffect, useCallback } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { resultForTable, resultForColumnsTable } from 'salvageunion-reference'
import type { SURefObjectTable, SURefObjectTableContent } from 'salvageunion-reference'
import { roll } from '@randsum/roller'
import { Copy, X } from 'lucide-react'
import { toast } from 'sonner'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { Text } from '../base/Text'
import { Badge } from '../chrome/Badge'
import { FOCUS_RING_ON_TONE } from '../chrome/interaction'
import { cn } from '../../utils/cn'
import type { SizeRung } from '../../styles/sizing'

type DigestedRollTable = {
  order: number
  label: string | null
  value: string
  key: string
}

type TableContent = string | { label?: string; value: string }

type RollTableType =
  | SURefObjectTable
  | { type: 'standard' | 'alternate' | 'flat' | 'full'; [key: string]: TableContent }

type ColumnsTableData = Extract<SURefObjectTable, { type: 'columns' }>

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
    <Badge
      shape="stamp"
      as="div"
      size="compact"
      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 tracking-caps-snug"
    >
      <span className="inline-flex min-w-0 items-center gap-3">
        {collapsible && (
          <ExpandToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        )}
        {titleSelect ? <TitleSelect title={title} select={titleSelect} /> : title}
      </span>
      {!disabled && (
        <span className="inline-flex items-center gap-2">
          Roll the Die
          <button
            type="button"
            onClick={handleRoll}
            className="inline-flex cursor-pointer items-center gap-1 rounded-badge border-2 border-rust bg-rust px-[11px] py-[3px] font-cond text-badge font-bold uppercase tracking-caps-tight text-paper hover:border-rust-hi hover:bg-rust-hi"
            aria-label="Roll on this table"
            title="Roll on this table"
          >
            Roll
            <DiceIcon compact />
          </button>
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
      className={cn('shrink-0 transition-transform', flipped && 'rotate-180')}
    >
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/** The expand/collapse control shown in a collapsible roll-table header. */
function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="inline-flex items-center gap-1 font-cond text-badge font-bold uppercase tracking-caps-tight text-paper/80 hover:text-paper"
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
      className={cn(
        // `uppercase` is NOT redundant with the band: the UA reset gives
        // `button` its own `text-transform: none`, so without it the trigger
        // reads Title Case beside a band that is otherwise all caps.
        'inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-badge border border-paper/40 px-2 py-0.5 text-left uppercase text-paper hover:border-paper hover:bg-paper/10',
        FOCUS_RING_ON_TONE
      )}
    >
      <span className="truncate">{title}</span>
      <Caret flipped={select.open} />
    </button>
  )
}

function digestRollTable(table: RollTableType): DigestedRollTable[] {
  if (!table) return []

  const getSortValue = (key: string): number => {
    if (key === 'type') return -1
    const firstPart = key.split('-')[0]?.trim()
    if (!firstPart) return 0
    const num = parseInt(firstPart, 10)
    return Number.isNaN(num) ? 0 : num
  }

  const sorted = Object.keys(table)
    .filter((key) => key !== 'type')
    .sort((a, b) => {
      const aNum = getSortValue(a)
      const bNum = getSortValue(b)
      return bNum - aNum
    })

  return sorted
    .map((key, order) => {
      const content = table[key as keyof typeof table]

      if (
        content &&
        typeof content === 'object' &&
        content !== null &&
        'value' in content &&
        typeof (content as { value: unknown }).value === 'string'
      ) {
        const tableContent = content as { label?: string; value: string }
        return {
          order,
          label: tableContent.label || null,
          value: tableContent.value,
          key,
        }
      }

      const fullDescription = typeof content === 'string' ? content : ''
      const parts = fullDescription.split(':')
      const labelPart = parts[0]?.trim()
      const valuePart = parts.slice(1).join(':').trim()

      return {
        order,
        label: labelPart && labelPart !== valuePart ? labelPart : null,
        value: valuePart || fullDescription,
        key,
      }
    })
    .filter((item): item is DigestedRollTable => item.value !== undefined)
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
    <div className={cn('text-ink', compact ? 'text-xs' : 'text-base')}>
      {label && <span className="font-bold">{label}: </span>}
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
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      navigator.clipboard.writeText(resultText).then(() => {
        toast.success('Copied', { id: 'clipboard-copy', duration: 1500 })
      })
    },
    [resultText]
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

  // Shared box metrics so Copy / Reroll / Clear line up as equal-sized buttons:
  // identical border, padding and text size (compact and non-compact each
  // consistent). Only the fill colour differs per action.
  const boxMetrics = cn(
    'flex cursor-pointer items-center gap-1 border border-ink font-bold',
    compact ? 'px-2 text-xs' : 'px-3 text-sm'
  )
  const iconSize = compact ? 'h-3 w-3' : 'h-3.5 w-3.5'

  return (
    <div
      className={cn(
        'absolute bottom-[-26px] left-1/2 z-[2] flex -translate-x-1/2 items-center',
        compact ? 'gap-0.5' : 'gap-1'
      )}
    >
      <button
        type="button"
        onClick={handleCopy}
        className={cn(boxMetrics, 'bg-wk-faint text-ink hover:bg-wk-faint/80')}
        aria-label="Copy result to clipboard"
      >
        Copy
        <Copy className={iconSize} />
      </button>
      <button
        type="button"
        onClick={handleReroll}
        className={cn(boxMetrics, 'bg-ink text-paper hover:bg-brand-srd')}
      >
        Reroll
        <DiceIcon compact={compact} />
      </button>
      {onClear && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(boxMetrics, 'bg-paper text-ink hover:bg-band-cream')}
          aria-label="Clear result"
        >
          Clear
          <X className={iconSize} />
        </button>
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
    <div className="relative">
      <div
        className={cn(
          'grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out',
          hasResult ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="min-h-0">
          <div
            className={cn(
              'border-t-2 border-pilot-light bg-band-cream',
              compact ? 'px-2 py-1.5' : 'px-3 py-2'
            )}
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
    const colRoll = roll('1d20').total
    const entryRoll = roll('1d20').total
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
    <div className="relative overflow-visible">
      <div className="sr-only" aria-live="assertive" role="status">
        {rollAnnouncement}
      </div>

      <div className="rounded-card border-2 border-pilot-light">
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
          <div className={cn('text-left text-ink', compact ? 'text-xs' : 'text-base')}>
            <span className="font-bold">{result?.entryKey}:</span> {result?.value}
          </div>
        </CollapsedResultSlideout>

        {expanded && (
          <div className="overflow-visible">
            <table className="w-full border-collapse">
              <caption className="sr-only">{tableName || 'Columns roll table'}</caption>
              <thead>
                <tr>
                  {COLUMN_KEYS.map((colKey) => (
                    <th
                      key={colKey}
                      scope="col"
                      className={cn(
                        'text-left font-bold text-ink',
                        compact ? 'px-2 py-1 text-lg' : 'px-3 py-2 text-2xl'
                      )}
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
                      className={cn(
                        // Codex `.a-rt` alternating bands: tone tint / warm paper + row hairline.
                        'border-b border-ink/10',
                        i % 2 === 0 ? 'bg-pilot-light' : 'bg-band-cream'
                      )}
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
                            className={cn(
                              'relative text-left text-ink transition-all duration-200',
                              compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-base',
                              isHighlighted &&
                                'z-[1] scale-[1.04] cursor-pointer outline-4 outline-ink shadow-[0_14px_40px_var(--color-ink-85)]'
                            )}
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
                            <span className="font-bold">{entryNum}:</span> {entry?.value}
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
    const { key } = resultForTable(table as SURefObjectTable, roll('1d20').total)
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
    <div className="relative overflow-visible">
      {/* Screen reader announcement for roll results */}
      <div className="sr-only" aria-live="assertive" role="status">
        {rollAnnouncement}
      </div>

      <div className="overflow-visible rounded-card border-2 border-pilot-light transition-opacity duration-200">
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
          <div className={cn('flex flex-row flex-wrap', compact ? 'gap-1' : 'gap-2')}>
            <div
              className={cn(
                'flex w-[52px] shrink-0 flex-col items-center justify-center self-stretch border-r border-ink/20 font-normal tabular-nums',
                compact ? 'py-1' : 'py-2'
              )}
            >
              <Text
                className={cn(
                  'whitespace-nowrap text-center font-bold leading-none text-ink',
                  compact ? 'text-sm' : 'text-lg'
                )}
              >
                {highlightedEntry?.key}
              </Text>
            </div>
            <div
              className={cn(
                'flex flex-[4] flex-row flex-wrap items-center',
                compact ? 'py-0.5' : 'py-1'
              )}
            >
              <RollTableDescription
                label={highlightedEntry?.label ?? null}
                value={highlightedEntry?.value ?? ''}
                compact={compact}
              />
            </div>
          </div>
        </CollapsedResultSlideout>
        {expanded && (
          <table className="w-full border-collapse">
            <caption className="sr-only">{tableName || 'Roll table'}</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Roll</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {digestedTable.map(({ label, value, key }, index) => {
                if (key === 'type') return null
                const isHighlighted = highlightedKey === key
                // Codex `.a-rt` alternating full-row bands: tone tint / warm paper.
                const bgColor = index % 2 === 0 ? 'bg-pilot-light' : 'bg-band-cream'

                return (
                  <tr
                    ref={isHighlighted ? highlightedRowRef : null}
                    key={key}
                    aria-selected={isHighlighted || undefined}
                    tabIndex={isHighlighted ? 0 : undefined}
                    className={cn(
                      'relative flex flex-row flex-wrap border-b border-ink/10 transition-all duration-200',
                      bgColor,
                      isHighlighted &&
                        'z-[1] scale-[1.04] cursor-pointer shadow-[0_0_0_4px_var(--color-ink-85),0_14px_40px_var(--color-ink-85)]',
                      compact ? 'gap-1' : 'gap-2'
                    )}
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
                      <td className="contents">
                        <ResultActionBar
                          compact={compact}
                          resultText={label ? `${label}: ${value}` : value}
                          onReroll={handleRoll}
                        />
                      </td>
                    )}
                    <th
                      scope="row"
                      className={cn(
                        // Codex `.a-rt .band`: fixed 52px roll column, centred, with a right hairline.
                        'flex w-[52px] shrink-0 flex-col items-center justify-center self-stretch border-r border-ink/20 font-normal tabular-nums',
                        compact ? 'py-1' : 'py-2'
                      )}
                    >
                      <Text
                        className={cn(
                          'whitespace-nowrap text-center font-bold leading-none text-ink',
                          compact ? 'text-sm' : 'text-lg'
                        )}
                      >
                        {key}
                      </Text>
                    </th>
                    <td
                      className={cn(
                        'flex flex-[4] flex-row flex-wrap items-center',
                        compact ? 'py-0.5' : 'py-1'
                      )}
                    >
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
