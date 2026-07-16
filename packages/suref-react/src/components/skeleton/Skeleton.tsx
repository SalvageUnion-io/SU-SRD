import { cn } from '../../utils/cn'

export type SkeletonMode = 'card' | 'list' | 'text'

type SkeletonProps = {
  /** Anatomy to mirror: a framed card, a stack of rows, or lines of text. */
  mode?: SkeletonMode
  /** Row / line count for `list` and `text` (and body lines for `card`). */
  rows?: number
  className?: string
}

/** One ink-alpha ghost bar on off-white. */
function Ghost({ className }: { className?: string }) {
  return <div className={cn('rounded-badge bg-ink/10', className)} />
}

/**
 * Skeleton — the generic loading placeholder (ruleset §"Skeleton").
 *
 * Mirrors the real anatomy (frame / band / body) with **ink-alpha ghosts on
 * off-white**, so the loaded content drops in with **zero layout shift**. The
 * card-specific `CardSkeleton` is a composition of this idea;
 * this is the atom, driven by `mode` + `rows`.
 */
export function Skeleton({ mode = 'card', rows = 3, className }: SkeletonProps) {
  if (mode === 'text') {
    return (
      <div role="status" aria-label="Loading" className={cn('space-y-2', className)}>
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
      <div role="status" aria-label="Loading" className={cn('space-y-2', className)}>
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

  // card — frame + band + body, mirroring the DisplayCard anatomy.
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('overflow-hidden rounded-card border-2 border-ink/15 bg-paper', className)}
    >
      <div className="flex items-center gap-2 bg-ink/10 px-3 py-2.5">
        <Ghost className="h-4 w-2/5 bg-ink/20" />
        <Ghost className="h-3 w-1/4 bg-ink/15" />
      </div>
      <div className="space-y-2 p-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Ghost
            // biome-ignore lint/suspicious/noArrayIndexKey: ghost body lines are positional
            key={i}
            className={cn('h-3', i === rows - 1 ? 'w-3/5' : i % 2 === 0 ? 'w-full' : 'w-4/5')}
          />
        ))}
      </div>
    </div>
  )
}
