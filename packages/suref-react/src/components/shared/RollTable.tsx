import { useState, useRef, useEffect, useCallback } from 'react'
import { resultForTable, resultForColumnsTable, isColumnsTable } from 'salvageunion-reference'
import type { SURefObjectTable, SURefObjectTableContent } from 'salvageunion-reference'
import { roll } from '@randsum/roller'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { Text } from '../base/Text'
import { cn } from '../../utils/cn'

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

type RollTableDisplayProps = {
  table: RollTableType
  showCommand?: boolean
  disabled?: boolean
  compact?: boolean
  tableName?: string
  /** Only allow a single roll — disables the roll button after first use and hides reroll */
  singleRoll?: boolean
  /** Called with the result text (and roll key) when the built-in roll button is used */
  onRollResult?: (text: string, key: string) => void
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
    <div className={cn('text-su-black', compact ? 'text-xs' : 'text-base')}>
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
  hideReroll,
}: {
  compact?: boolean
  resultText: string
  onReroll: () => void
  hideReroll?: boolean
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
        className={cn(
          'flex cursor-pointer items-center gap-1 border border-su-black bg-su-grey-light font-bold text-su-black hover:bg-su-grey-light/80',
          compact ? 'px-2 text-xs' : 'px-3 text-sm'
        )}
        aria-label="Copy result to clipboard"
      >
        Copy
        <Copy className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </button>
      {!hideReroll && (
        <button
          type="button"
          onClick={handleReroll}
          className={cn(
            'flex cursor-pointer items-center gap-1 bg-su-black font-bold text-paper hover:bg-brand-srd',
            compact ? 'px-2 text-xs' : 'px-3 text-sm'
          )}
        >
          Reroll
          <DiceIcon compact={compact} />
        </button>
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
  compact,
  disabled,
  table,
  showCommand = false,
  tableName,
  singleRoll = false,
  onRollResult,
}: RollTableDisplayProps) {
  const [result, setResult] = useState<ColumnsRollResult | null>(null)
  const [rollAnnouncement, setRollAnnouncement] = useState('')
  const [hasRolled, setHasRolled] = useState(false)
  const highlightedRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    if (result && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [result])

  const tableData = table as ColumnsTableData

  const handleRoll = () => {
    if (singleRoll && hasRolled) return
    setResult(null)
    setRollAnnouncement('')
    const colRoll = roll('1d20').total
    const entryRoll = roll('1d20').total
    const res = resultForColumnsTable(table as SURefObjectTable, colRoll, entryRoll)
    setTimeout(() => {
      if (res.success) {
        setResult({
          columnKey: res.columnKey,
          entryKey: res.entryKey,
          value: res.result.value,
        })
        if (singleRoll) setHasRolled(true)
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

      <div className="rounded-card border-2 border-su-orange-light">
        {showCommand && (
          <div className="flex items-center justify-between gap-2 bg-su-black px-2.5 py-1.5 font-cond text-xs font-bold uppercase tracking-caps-snug text-paper">
            <span>{tableName || 'Roll table'}</span>
            {!disabled && (
              <span className="inline-flex items-center gap-2">
                Roll the Die
                <button
                  type="button"
                  onClick={handleRoll}
                  disabled={singleRoll && hasRolled}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-badge border-2 border-rust bg-rust px-[11px] py-[3px] font-cond text-badge font-bold uppercase tracking-caps-tight text-paper',
                    singleRoll && hasRolled
                      ? 'cursor-not-allowed opacity-30'
                      : 'cursor-pointer hover:border-rust-hi hover:bg-rust-hi'
                  )}
                  aria-label="Roll on this table"
                  title="Roll on this table"
                >
                  Roll
                  <DiceIcon compact />
                </button>
              </span>
            )}
          </div>
        )}

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
                      'text-left font-bold text-su-black',
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
                      i % 2 === 0 ? 'bg-su-orange-light' : 'bg-su-paper'
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
                            'relative text-left text-su-black transition-all duration-200',
                            compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-base',
                            isHighlighted &&
                              'z-[1] scale-[1.04] cursor-pointer outline-4 outline-su-black shadow-[0_14px_40px_rgba(0,0,0,0.85)]'
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
                              hideReroll={singleRoll}
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
      </div>
    </div>
  )
}

export function RollTable(props: RollTableDisplayProps) {
  if (isColumnsTable(props.table as SURefObjectTable)) {
    return <ColumnsRollTable {...props} />
  }
  return <StandardRollTable {...props} />
}

function StandardRollTable({
  compact,
  disabled,
  table,
  showCommand = false,
  tableName,
  singleRoll = false,
  onRollResult,
}: RollTableDisplayProps) {
  const digestedTable = digestRollTable(table)
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const [hasRolled, setHasRolled] = useState(false)
  const [rollAnnouncement, setRollAnnouncement] = useState('')
  const highlightedRowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (highlightedKey && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedKey])

  const handleRoll = () => {
    if (singleRoll && hasRolled) return
    setHighlightedKey(null)
    setRollAnnouncement('')
    const { key } = resultForTable(table as SURefObjectTable, roll('1d20').total)
    setTimeout(() => {
      setHighlightedKey(key)
      if (singleRoll) setHasRolled(true)
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

  return (
    <div className="relative overflow-visible">
      {/* Screen reader announcement for roll results */}
      <div className="sr-only" aria-live="assertive" role="status">
        {rollAnnouncement}
      </div>

      <div className="overflow-visible rounded-card border-2 border-su-orange-light transition-opacity duration-200">
        {showCommand && (
          <div className="flex items-center justify-between gap-2 bg-su-black px-2.5 py-1.5 font-cond text-xs font-bold uppercase tracking-caps-snug text-paper">
            <span>{tableName || 'Roll table'}</span>
            {!disabled && (
              <span className="inline-flex items-center gap-2">
                Roll the Die
                <button
                  type="button"
                  onClick={handleRoll}
                  disabled={singleRoll && hasRolled}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-badge border-2 border-rust bg-rust px-[11px] py-[3px] font-cond text-badge font-bold uppercase tracking-caps-tight text-paper',
                    singleRoll && hasRolled
                      ? 'cursor-not-allowed opacity-30'
                      : 'cursor-pointer hover:border-rust-hi hover:bg-rust-hi'
                  )}
                  aria-label="Roll on this table"
                  title="Roll on this table"
                >
                  Roll
                  <DiceIcon compact />
                </button>
              </span>
            )}
          </div>
        )}
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
              const bgColor = index % 2 === 0 ? 'bg-su-orange-light' : 'bg-su-paper'

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
                      'z-[1] scale-[1.04] cursor-pointer shadow-[0_0_0_4px_rgba(0,0,0,0.9),0_14px_40px_rgba(0,0,0,0.85)]',
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
                        hideReroll={singleRoll}
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
                        'whitespace-nowrap text-center font-bold leading-none text-su-black',
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
      </div>
    </div>
  )
}
