import { cn } from '../../utils/cn'

type EntityCardSkeletonProps = {
  compact?: boolean
  className?: string
}

export function EntityCardSkeleton({ compact = false, className }: EntityCardSkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md shadow-lg',
        compact ? 'h-[60px]' : 'h-[120px]',
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
          <div className={cn('rounded bg-su-grey/30', compact ? 'h-4 w-24' : 'h-6 w-32')} />
          <div className={cn('rounded bg-su-grey/20', compact ? 'h-3 w-16' : 'h-4 w-20')} />
        </div>
      </div>
    </div>
  )
}
