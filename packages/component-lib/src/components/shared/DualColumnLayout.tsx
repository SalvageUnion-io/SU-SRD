import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type DualColumnLayoutProps = {
  left?: ReactNode
  right?: ReactNode
  className?: string
}

export function DualColumnLayout({ left, right, className }: DualColumnLayoutProps) {
  const hasLeft = left != null
  const hasRight = right != null
  const hasBoth = hasLeft && hasRight

  if (!hasLeft && !hasRight) return null

  return (
    <div
      className={cn('grid grid-cols-1 gap-4', hasBoth && 'lg:grid-cols-[1fr_auto_1fr]', className)}
    >
      {hasLeft && left}
      {hasBoth && <div className="hidden w-px bg-ink/15 lg:block" />}
      {hasRight && right}
    </div>
  )
}
