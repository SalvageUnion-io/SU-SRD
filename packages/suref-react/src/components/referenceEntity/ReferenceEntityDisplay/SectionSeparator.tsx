import type { ReactNode } from 'react'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'
import { useStickyHeader } from '../../shared/StickyHeaderContext'

type SectionSeparatorProps = {
  label: string
  fontSize?: string
  compact?: boolean
  children?: ReactNode
}

export function SectionSeparator({ label, fontSize, compact, children }: SectionSeparatorProps) {
  const isSticky = useStickyHeader()
  const resolvedFontSize = fontSize ?? (compact ? 'text-base' : 'text-lg')
  return (
    <div
      className={cn('relative flex items-center gap-3', isSticky && 'sticky z-10 py-1')}
      style={
        isSticky ? { top: 'var(--sticky-content-top, var(--sticky-header-h, 0px))' } : undefined
      }
    >
      <div className="h-px flex-1 bg-su-grey-light" aria-hidden="true" />
      <Text variant="pseudoheader" className={cn(resolvedFontSize)}>
        {label}
      </Text>
      {children ? (
        <div className="flex shrink-0 items-center pl-2 pr-1">{children}</div>
      ) : (
        <div className="h-px flex-1 bg-su-grey-light" aria-hidden="true" />
      )}
    </div>
  )
}
