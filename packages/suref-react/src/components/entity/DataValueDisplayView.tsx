import type { DataValue } from '../../types/common'
import type { SURefObjectDataValue } from 'salvageunion-reference'
import { ActivationCostBox } from '../shared/ActivationCostBox'
import { TraitKeywordDisplayView } from './TraitKeywordDisplayView'
import { RangeValueDisplay } from './RangeValueDisplay'
import { ValueDisplay } from '../shared/ValueDisplay'
import { Text } from '../base/Text'
import { cn } from '../../utils/cn'
import { useMemo } from 'react'
import { getTiltRotation } from '../../utils/tiltUtils'

/**
 * View-only component for rendering DataValue items
 * Accepts damaged state as a prop instead of reading from context
 * Accepts both DataValue (from types/common) and SURefObjectDataValue (from salvageunion-reference)
 */
export function DataValueDisplayView({
  item,
  compact = false,
  damaged = false,
}: {
  item: DataValue | SURefObjectDataValue
  compact?: boolean
  /** Whether the entity is damaged (affects visual styling) */
  damaged?: boolean
}) {
  const valueRotation = useMemo(() => (damaged ? getTiltRotation() : 0), [damaged])

  if (item.type === 'cost') {
    // If value is provided, use it as currency; otherwise parse from label
    let cost = item.label
    let currency = item.value

    if (!currency && typeof item.label === 'string') {
      // Parse label like "1 AP" or "X EP" to extract cost and currency
      const parts = item.label.trim().split(/\s+/)
      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1]
        if (lastPart === 'AP' || lastPart === 'EP' || lastPart === 'XP') {
          cost = parts.slice(0, -1).join(' ')
          currency = lastPart
        }
      }
    }

    return <ActivationCostBox cost={cost} currency={currency} compact={compact} />
  }

  if (item.type === 'trait') {
    return (
      <TraitKeywordDisplayView
        label={item.label}
        value={item.value}
        compact={compact}
        schemaName="traits"
        inline={false}
        damaged={damaged}
      />
    )
  }

  if (item.type === 'keyword') {
    return (
      <TraitKeywordDisplayView
        label={item.label}
        value={item.value}
        compact={compact}
        schemaName="keywords"
        inline={false}
        damaged={damaged}
      />
    )
  }

  if (item.type === 'range') {
    return (
      <RangeValueDisplay
        label={item.label}
        value={item.value}
        compact={compact}
        damaged={damaged}
        rotation={valueRotation}
      />
    )
  }

  if (item.type === 'requirement') {
    const trees = String(item.value ?? '').split('||')
    const fontSize = compact ? 'text-xs' : 'text-base'
    const fontWeight = compact ? 'font-normal' : 'font-semibold'
    return (
      <span
        className={cn(
          'shrink-0 grow-0 cursor-default whitespace-nowrap border border-su-black',
          'inline-flex items-stretch w-fit'
        )}
      >
        <Text
          variant="pseudoheader"
          as="span"
          className={cn('!self-auto uppercase', fontSize, fontWeight)}
        >
          {item.label}
        </Text>
        {trees.map((tree, i) => (
          <span key={i} className="contents">
            <Text
              variant="pseudoheaderInverse"
              as="span"
              className={cn('!self-auto uppercase', fontSize, fontWeight)}
            >
              {tree.trim()}
            </Text>
            {i < trees.length - 1 && (
              <Text
                variant="pseudoheader"
                as="span"
                className={cn('!self-auto uppercase', fontSize, fontWeight)}
              >
                OR
              </Text>
            )}
          </span>
        ))}
        <Text
          variant="pseudoheader"
          as="span"
          className={cn('!self-auto uppercase', fontSize, fontWeight)}
        >
          Tree
        </Text>
      </span>
    )
  }

  if (item.type === 'meta') {
    return (
      <ValueDisplay
        label={item.label}
        compact={compact}
        inline={false}
        damaged={damaged}
        rotation={valueRotation}
      />
    )
  }

  return (
    <ValueDisplay
      label={item.label}
      value={item.value}
      compact={compact}
      inline={false}
      damaged={damaged}
      rotation={valueRotation}
    />
  )
}
