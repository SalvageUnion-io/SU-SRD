import { cn } from '../../utils/cn'

type SchemaViewerSkeletonProps = {
  count?: number
  className?: string
}

export function SchemaViewerSkeleton({ count = 6, className }: SchemaViewerSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[120px] animate-pulse rounded-md bg-su-grey-light/30 shadow-lg">
          <div className="h-[80px] rounded-t-sm bg-su-grey-light/50 p-1.5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-32 rounded bg-su-grey/30" />
              <div className="h-4 w-20 rounded bg-su-grey/20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
