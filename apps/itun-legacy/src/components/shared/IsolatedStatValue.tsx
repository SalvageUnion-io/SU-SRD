import { StatsBar } from 'suref-react'
import type { StatItem } from 'suref-react'
import { cn } from '../../lib/utils'
import { SimpleDisplayContainer } from './SimpleDisplayContainer'

type IsolatedStatValueProps = {
  /** Label half-sunken into the top border (e.g., "Pilot", "Cargo") */
  label?: string
  /** Array of stat items rendered side by side (same shape as DisplayCard stats) */
  stats: StatItem[]
  /** Background color class (default: bg-su-orange) */
  bg?: string
  compact?: boolean
  className?: string
}

export function IsolatedStatValue({
  label,
  stats,
  bg,
  compact,
  className,
}: IsolatedStatValueProps) {
  return (
    <SimpleDisplayContainer
      label={label}
      bg={bg}
      compact={compact}
      className={cn('w-fit', className)}
    >
      <StatsBar stats={stats} compact={compact} />
    </SimpleDisplayContainer>
  )
}
