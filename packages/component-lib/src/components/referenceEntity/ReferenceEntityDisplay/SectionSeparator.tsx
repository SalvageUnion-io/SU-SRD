import type { ReactNode } from 'react'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'

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
  const resolvedFontSize = fontSize ?? (compact ? 'text-base' : 'text-lg')
  return (
    <div className="relative flex items-center gap-3">
      <div className="flex-1 border-t border-dashed border-wk-faint" aria-hidden="true" />
      <span className="inline-flex shrink-0 border border-ink">
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
      <div className="flex-1 border-t border-dashed border-wk-faint" aria-hidden="true" />
      {children && (
        <div className="absolute right-0 flex shrink-0 items-center bg-paper pl-3">{children}</div>
      )}
    </div>
  )
}
