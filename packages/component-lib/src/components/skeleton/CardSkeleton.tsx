import { cn } from '../../utils/cn'

type CardSkeletonProps = {
  compact?: boolean
  className?: string
}

export function CardSkeleton({ compact = false, className }: CardSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading entity"
      className={cn('w-full animate-pulse rounded-md shadow-lg', 'bg-ink/8', className)}
    >
      <div
        className={cn(
          'rounded-t-sm bg-ink/10',
          compact ? 'min-h-[60px] p-1' : 'min-h-[80px] p-1.5'
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn('rounded bg-ink/20', compact ? 'h-4 w-2/5' : 'h-6 w-2/5')} />
          <div className={cn('rounded bg-ink/15', compact ? 'h-3 w-1/4' : 'h-4 w-1/4')} />
        </div>
      </div>
      <div className={cn('rounded-b-md bg-paper/50', compact ? 'p-2' : 'p-3')}>
        <div className="space-y-2">
          <div className={cn('rounded bg-ink/15', compact ? 'h-3 w-full' : 'h-4 w-full')} />
          <div className={cn('rounded bg-ink/12', compact ? 'h-3 w-4/5' : 'h-4 w-4/5')} />
          <div className={cn('rounded bg-ink/8', compact ? 'h-3 w-3/5' : 'h-4 w-3/5')} />
        </div>
      </div>
    </div>
  )
}
