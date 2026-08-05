import { cn } from '../../utils/cn'

export type SkeletonMode = 'card' | 'list' | 'text'

type SkeletonProps = {
  /** Anatomy to mirror: a framed card, a stack of rows, or lines of text. */
  mode?: SkeletonMode
  /** Row / line count for `list` and `text` (and body lines for `card`). */
  rows?: number
  /** `card` only: mirror the compact (medium) card density — shorter band,
   * tighter body (the absorbed `CardSkeleton compact`). */
  compact?: boolean
  className?: string
}

/** One ink-alpha ghost bar on off-white — the shared unit every skeleton
 * surface composes (this file's modes, SheetSkeleton's sheet-shaped ghosts). */
export function Ghost({ className }: { className?: string }) {
  return <div className={cn('rounded-badge bg-ink/10', className)} />
}

/**
 * Skeleton — the generic loading placeholder (ruleset §"Skeleton").
 *
 * Mirrors the real anatomy (frame / band / body) with **ink-alpha ghosts on
 * off-white**, so the loaded content drops in with **zero layout shift**. The
 * former card-specific `CardSkeleton` is absorbed here as `mode="card"` (+
 * `compact`); this is the atom, driven by `mode` + `rows`.
 */
export function Skeleton({ mode = 'card', rows = 3, compact = false, className }: SkeletonProps) {
  if (mode === 'text') {
    return (
      <div
        role="status"
        aria-label="Loading"
        className={cn('motion-safe:animate-pulse space-y-2', className)}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <Ghost
            // biome-ignore lint/suspicious/noArrayIndexKey: ghost lines are positional
            key={i}
            className={cn('h-3', i === rows - 1 ? 'w-3/5' : i % 2 === 0 ? 'w-full' : 'w-4/5')}
          />
        ))}
      </div>
    )
  }

  if (mode === 'list') {
    return (
      <div
        role="status"
        aria-label="Loading"
        className={cn('motion-safe:animate-pulse space-y-2', className)}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: ghost rows are positional
            key={i}
            className="flex items-center gap-3 rounded-card border-chrome border-ink/15 bg-paper px-3 py-2.5"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Ghost className="h-3.5 w-2/5" />
              <Ghost className="h-2.5 w-3/5" />
            </div>
            <Ghost className="h-6 w-14" />
          </div>
        ))}
      </div>
    )
  }

  // card — frame + band + body, mirroring the Card anatomy. `compact`
  // mirrors the medium (compact) card density: shorter band, tighter body.
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'motion-safe:animate-pulse overflow-hidden rounded-card border-2 border-ink/15 bg-paper',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 bg-ink/10 px-3',
          compact ? 'min-h-[60px] py-2' : 'min-h-[80px] py-2.5'
        )}
      >
        <Ghost className={cn('w-2/5 bg-ink/20', compact ? 'h-4' : 'h-6')} />
        <Ghost className={cn('w-1/4 bg-ink/15', compact ? 'h-3' : 'h-4')} />
      </div>
      <div className={cn('space-y-2', compact ? 'p-2' : 'p-3')}>
        {Array.from({ length: rows }).map((_, i) => (
          <Ghost
            // biome-ignore lint/suspicious/noArrayIndexKey: ghost body lines are positional
            key={i}
            className={cn(
              compact ? 'h-3' : 'h-4',
              i === rows - 1 ? 'w-3/5' : i % 2 === 0 ? 'w-full' : 'w-4/5'
            )}
          />
        ))}
      </div>
    </div>
  )
}
