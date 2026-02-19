import type { ReactNode } from 'react'
import { Text } from 'suref-react'
import { cn } from '../../lib/utils'

type SimpleDisplayContainerProps = {
  children: ReactNode
  /** Optional label half-sunken into the top border (like StatDisplay labels) */
  label?: string
  compact?: boolean
  /** Background color class (default: bg-su-orange) */
  bg?: string
  className?: string
}

export function SimpleDisplayContainer({
  children,
  label,
  compact,
  bg = 'bg-su-orange',
  className,
}: SimpleDisplayContainerProps) {
  return (
    <div className={cn('relative flex items-center', className)}>
      {label && (
        <Text
          variant="pseudoheader"
          as="span"
          className={cn(
            'absolute left-1/2 top-0 z-[1] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap uppercase',
            compact ? 'text-[10px]' : 'text-xs'
          )}
        >
          {label}
        </Text>
      )}
      <div
        className={cn(
          'flex items-center rounded-md border-2 border-su-black',
          bg,
          compact ? 'gap-1 px-2 py-1.5' : 'gap-2 px-3 py-2',
          label && (compact ? 'pt-2.5' : 'pt-3')
        )}
      >
        {children}
      </div>
    </div>
  )
}
