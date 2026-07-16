import { cn } from '../../utils/cn'
import type { ReactNode } from 'react'

type SheetProps = {
  label?: string
  value?: string
  children?: ReactNode
  labelColor?: string
  compact?: boolean
  className?: string
}

export function Sheet({
  label,
  value,
  children,
  labelColor = 'text-ink',
  compact = false,
  className,
}: SheetProps) {
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
