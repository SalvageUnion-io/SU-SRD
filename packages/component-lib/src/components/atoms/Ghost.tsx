import type { CSSProperties } from 'react'
import { cn } from '../../utils/cn'

/** One ink-alpha ghost bar on off-white — the shared unit every skeleton
 * surface composes (Skeleton's modes, SheetSkeleton's sheet-shaped ghosts).
 * Its fill and radius are `.su-ghost`'s, so a caller's class can still retone
 * it; Skeleton sizes and retones its own ghosts through `style`. */
export function Ghost({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('su-ghost', className)} style={style} />
}
