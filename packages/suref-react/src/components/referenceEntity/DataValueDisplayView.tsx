import type { DataValue } from '../../types/common'
import type { SURefObjectDataValue } from 'salvageunion-reference'
import { ActivationCostBox } from '../shared/ActivationCostBox'
import { TraitKeywordDisplayView } from './TraitKeywordDisplayView'
import { RangeValueDisplay } from './RangeValueDisplay'
import { StatDisplay } from '../shared/StatDisplay'
import { Text } from '../base/Text'
import { cn } from '../../utils/cn'

/**
 * View-only component for rendering DataValue items
 * Accepts both DataValue (from types/common) and SURefObjectDataValue (from salvageunion-reference)
 */
export function DataValueDisplayView({
  item,
  compact = false,
}: {
  item: DataValue | SURefObjectDataValue
  compact?: boolean
}) {
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
      />
    )
  }

  if (item.type === 'range') {
    return <RangeValueDisplay label={item.label} value={item.value} compact={compact} />
  }

  if (item.type === 'requirement') {
    const trees = String(item.value ?? '').split('||')
    const fontSize = compact ? 'text-xs' : 'text-sm'
    const fontWeight = compact ? 'font-normal' : 'font-semibold'
    return (
      <span
        className={cn(
          'shrink-0 grow-0 cursor-default whitespace-nowrap border border-su-black',
          'inline-flex items-stretch w-fit'
        )}
      >
        <Text
          variant="pseudoheaderInverse"
          as="span"
          className={cn('!self-auto uppercase', fontSize, fontWeight)}
        >
          {item.label}
        </Text>
        {trees.map((tree, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static segments parsed from a fixed label string; never reordered
          <span key={i} className="contents">
            <Text
              variant="pseudoheader"
              as="span"
              className={cn('!self-auto uppercase', fontSize, fontWeight)}
            >
              {tree.trim()}
            </Text>
            {i < trees.length - 1 && (
              <Text
                variant="pseudoheaderInverse"
                as="span"
                className={cn('!self-auto uppercase', fontSize, fontWeight)}
              >
                OR
              </Text>
            )}
          </span>
        ))}
        <Text
          variant="pseudoheaderInverse"
          as="span"
          className={cn('!self-auto uppercase', fontSize, fontWeight)}
        >
          Tree
        </Text>
      </span>
    )
  }

  if (item.type === 'segmented') {
    const segments = String(item.value ?? '').split('||')
    const fontSize = compact ? 'text-xs' : 'text-sm'
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
        {segments.map((seg, i) => (
          <Text
            // biome-ignore lint/suspicious/noArrayIndexKey: static segments parsed from a fixed value string; alternating style is index-driven
            key={i}
            variant={i % 2 === 0 ? 'pseudoheaderInverse' : 'pseudoheader'}
            as="span"
            className={cn('!self-auto uppercase', fontSize, fontWeight)}
          >
            {seg.trim()}
          </Text>
        ))}
      </span>
    )
  }

  if (item.type === 'meta') {
    const useRustBg = item.label === 'Recommended' || item.label === 'Legal Starting Pattern'
    return (
      <StatDisplay
        orientation="horizontal"
        label={item.label}
        compact={compact}
        inline={false}
        bgColor={useRustBg ? 'var(--color-su-rust)' : undefined}
        textColor={useRustBg ? 'var(--color-su-white)' : undefined}
        borderColor={useRustBg ? 'var(--color-su-rust)' : undefined}
      />
    )
  }

  return (
    <StatDisplay
      orientation="horizontal"
      label={item.label}
      value={item.value}
      compact={compact}
      inline={false}
    />
  )
}
