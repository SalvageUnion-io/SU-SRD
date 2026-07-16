import { cn } from '../../utils/cn'
import type { ReactNode } from 'react'

type SheetDisplayProps = {
  label?: string
  value?: string
  children?: ReactNode
  labelColor?: string
  compact?: boolean
  className?: string
}

export function SheetDisplay({
  label,
  value,
  children,
  labelColor = 'text-ink',
  compact = false,
  className,
}: SheetDisplayProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <p className={cn('mb-1 font-bold uppercase', compact ? 'text-xs' : 'text-sm', labelColor)}>
          {label}
        </p>
      )}
      <div className={cn('font-normal leading-snug text-ink', compact ? 'text-sm' : 'text-base')}>
        {children || value}
      </div>
    </div>
  )
}
