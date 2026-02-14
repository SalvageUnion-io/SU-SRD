import { cn } from '../../utils/cn'

type EntityCardSkeletonProps = {
  compact?: boolean
  className?: string
}

export function EntityCardSkeleton({ compact = false, className }: EntityCardSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading entity"
      className={cn(
        'w-full animate-pulse rounded-md shadow-lg',
        compact ? 'min-h-[120px]' : 'min-h-[200px]',
        'bg-su-grey-light/30',
        className
      )}
    >
      <div
        className={cn(
          'rounded-t-sm bg-su-grey-light/50',
          compact ? 'h-[60px] p-1' : 'h-[80px] p-1.5'
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn('rounded bg-su-grey/30', compact ? 'h-4 w-2/5' : 'h-6 w-2/5')} />
          <div className={cn('rounded bg-su-grey/20', compact ? 'h-3 w-1/4' : 'h-4 w-1/4')} />
        </div>
      </div>
    </div>
  )
}
