/**
 * DashboardSkeleton — shimmer placeholder for the Pilots/Mechs/Crawlers grid
 * while entityStore hydration is in flight (design review U-2).
 *
 * Mirrors the hydrated layout (same `mt-5 grid … md:grid-cols-3` shell and
 * Row-shaped placeholders) so the swap to real content doesn't shift the
 * page. Columns 2–3 hide below `md`, matching the mobile single-column view.
 */

import { cn } from '../../lib/utils'

/** Row-shaped shimmer placeholder matching suref-react's `Row` frame. */
function SkeletonRow() {
  return (
    <li className="list-none">
      <div className="rounded-[3px] border-[1.5px] border-ink/15 bg-paper px-3 py-2.5">
        <div className="h-4 w-2/5 rounded bg-ink/10" />
        <div className="mt-2 h-3 w-3/5 rounded bg-ink/5" />
      </div>
    </li>
  )
}

function SkeletonColumn({ hiddenOnMobile = false }: { hiddenOnMobile?: boolean }) {
  return (
    <section aria-hidden="true" className={cn(hiddenOnMobile && 'hidden md:block')}>
      <div className="mb-3 flex items-center justify-between">
        <div className="h-5 w-24 rounded bg-rust/25" />
        <div className="h-7 w-28 rounded-[3px] border-[1.5px] border-ink/10 bg-paper" />
      </div>
      <ul className="flex flex-col gap-2.5">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </ul>
    </section>
  )
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading saved builds" className="animate-pulse">
      <div className="mt-5 grid grid-cols-1 gap-8 md:mt-6 md:grid-cols-3">
        <SkeletonColumn />
        <SkeletonColumn hiddenOnMobile />
        <SkeletonColumn hiddenOnMobile />
      </div>
    </div>
  )
}
