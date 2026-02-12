import { useState, useRef, useEffect } from 'react'
import { resultForTable } from 'salvageunion-reference'
import type { SURefObjectTable } from 'salvageunion-reference'
import { roll } from '@randsum/roller'
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

type RollTableDisplayProps = {
  table: RollTableType
  showCommand?: boolean
  disabled?: boolean
  compact?: boolean
  tableName?: string
}

function digestRollTable(table: RollTableType): DigestedRollTable[] {
  if (!table) return []

  const getSortValue = (key: string): number => {
    if (key === 'type') return -1
    const firstPart = key.split('-')[0]?.trim()
    if (!firstPart) return 0
    const num = parseInt(firstPart, 10)
    return isNaN(num) ? 0 : num
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

export function RollTable({
  compact,
  disabled,
  table,
  showCommand = false,
  tableName,
}: RollTableDisplayProps) {
  const digestedTable = digestRollTable(table)
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const highlightedRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (highlightedKey && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedKey])

  const handleRoll = () => {
    setHighlightedKey(null)
    const { key } = resultForTable(table as SURefObjectTable, roll('1d20').total)
    setTimeout(() => setHighlightedKey(key), 300)
  }

  const handleClearHighlight = () => {
    setHighlightedKey(null)
  }

  return (
    <div className="relative overflow-visible">
      <div className="overflow-visible transition-opacity duration-200">
        {showCommand && (
          <div
            className={cn(
              'flex items-center justify-center bg-su-black font-bold uppercase text-su-white',
              compact ? 'mb-1 gap-1 p-1' : 'mb-2 gap-2 p-2'
            )}
          >
            <Text as="span" className={cn('text-su-white', compact ? 'text-xs' : 'text-base')}>
              ROLL THE DIE:
            </Text>
            {tableName && !disabled && (
              <button
                onClick={handleRoll}
                className={cn(
                  'cursor-pointer rounded-md bg-transparent text-su-white hover:bg-brand-srd',
                  compact ? 'p-0.5' : 'p-1'
                )}
                aria-label="Roll on this table"
                title="Roll on this table"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height={compact ? '16' : '20'}
                  viewBox="0 -960 960 960"
                  width={compact ? '16' : '20'}
                  fill="currentColor"
                >
                  <path d="M240-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm480 0q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-600q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z" />
                </svg>
              </button>
            )}
          </div>
        )}
        {digestedTable.map(({ label, value, key }, index) => {
          if (key === 'type') return null
          const isHighlighted = highlightedKey === key
          const bgColor = index % 2 === 0 ? 'bg-su-orange-light' : 'bg-su-white'

          return (
            <div
              ref={isHighlighted ? highlightedRowRef : null}
              key={key + label + index}
              role={isHighlighted ? 'button' : undefined}
              tabIndex={isHighlighted ? 0 : undefined}
              className={cn(
                'relative flex flex-row flex-wrap transition-all duration-200',
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
                <button
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    handleRoll()
                  }}
                  className={cn(
                    'absolute bottom-[-26px] left-1/2 z-[2] flex -translate-x-1/2 cursor-pointer items-center gap-1 bg-su-black font-bold text-su-white hover:bg-brand-srd',
                    compact ? 'px-2 text-xs' : 'px-3 text-sm'
                  )}
                >
                  Reroll
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height={compact ? '14' : '16'}
                    viewBox="0 -960 960 960"
                    width={compact ? '14' : '16'}
                    fill="currentColor"
                  >
                    <path d="M240-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm480 0q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-600q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z" />
                  </svg>
                </button>
              )}
              <div
                className={cn(
                  'flex flex-1 flex-col items-center justify-center self-stretch',
                  compact ? 'py-1' : 'py-2'
                )}
              >
                <Text
                  className={cn(
                    'text-center font-bold text-su-black',
                    compact ? 'text-base' : 'text-xl'
                  )}
                >
                  {key}
                </Text>
              </div>
              <div
                className={cn(
                  'flex flex-[4] flex-row flex-wrap items-center',
                  compact ? 'py-0.5' : 'py-1'
                )}
              >
                <RollTableDescription label={label} value={value} compact={compact} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
