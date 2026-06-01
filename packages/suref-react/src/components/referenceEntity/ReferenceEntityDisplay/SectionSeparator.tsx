import type { ReactNode } from 'react'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'
import { useStickyHeader } from '../../shared/StickyHeaderContext'

type SectionSeparatorProps = {
  label: string
  value?: string
  fontSize?: string
  compact?: boolean
  children?: ReactNode
}

export function SectionSeparator({
  label,
  value,
  fontSize,
  compact,
  children,
}: SectionSeparatorProps) {
  const isSticky = useStickyHeader()
  const resolvedFontSize = fontSize ?? (compact ? 'text-base' : 'text-lg')
  return (
    <div
      className={cn('relative flex items-center gap-3', isSticky && 'sticky z-10 py-1')}
      style={
        isSticky ? { top: 'var(--sticky-content-top, var(--sticky-header-h, 0px))' } : undefined
      }
    >
      <div className="flex-1 border-t border-dashed border-su-grey-light" aria-hidden="true" />
      <span className="inline-flex shrink-0 border border-su-black">
        <Text variant="pseudoheader" as="span" className={cn(resolvedFontSize, 'font-semibold')}>
          {label}
        </Text>
        {value !== undefined && (
          <Text
            variant="pseudoheaderInverse"
            as="span"
            className={cn(resolvedFontSize, 'font-semibold')}
          >
            {value}
          </Text>
        )}
      </span>
      <div className="flex-1 border-t border-dashed border-su-grey-light" aria-hidden="true" />
      {children && (
        <div className="absolute right-0 flex shrink-0 items-center bg-su-white pl-3">
          {children}
        </div>
      )}
    </div>
  )
}
