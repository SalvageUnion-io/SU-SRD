/**
 * SheetSkeleton — shimmer placeholder for /sheet/:kind/:id while the route
 * loader hydrates the entity store (design review U-2).
 *
 * Mirrors the LiveSheet shell (sticky top bar → hero band → body slabs) so
 * the swap to the real sheet doesn't shift the page: same min-h-[58px] bar,
 * same horizontal padding rhythm, hero-sized frame, then two slab groups
 * (dashed-leader header + card placeholders).
 */

function SkeletonSlab() {
  return (
    <div className="mt-7 first:mt-0">
      {/* Slab header: label + dashed leader (suref-react `Slab` shape) */}
      <div className="mb-3.5 flex items-center gap-3">
        <div className="h-4 w-28 rounded bg-ink/15" />
        <div className="h-0.5 flex-1 rounded bg-ink/10" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-20 rounded-[6px] border-[1.5px] border-ink/15 bg-paper" />
        <div className="h-20 rounded-[6px] border-[1.5px] border-ink/15 bg-paper" />
      </div>
    </div>
  )
}

export function SheetSkeleton() {
  return (
    <div role="status" aria-label="Loading sheet" className="min-h-screen animate-pulse bg-wk-bg">
      {/* Sticky-bar placeholder (LiveSheet top bar footprint) */}
      <div className="flex min-h-[58px] items-center gap-4 border-b-2 border-ink/20 px-4 py-2 sm:px-[30px]">
        <div className="h-4 w-24 rounded bg-ink/15" />
        <div className="ml-auto flex items-center gap-2.5">
          <div className="h-7 w-16 rounded-[3px] border-[1.5px] border-ink/10 bg-paper" />
          <div className="h-7 w-16 rounded-[3px] border-[1.5px] border-ink/10 bg-paper" />
        </div>
      </div>

      {/* Hero band placeholder */}
      <div className="px-4 pb-1.5 pt-4 sm:px-[30px] sm:pt-[22px]">
        <div className="rounded-[6px] border-[3px] border-ink/20 bg-paper p-5 sm:p-6">
          <div className="h-8 w-1/2 rounded bg-ink/15 sm:w-2/5" />
          <div className="mt-3 h-4 w-1/3 rounded bg-ink/10" />
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="h-14 w-24 rounded border-[1.5px] border-ink/10 bg-wk-bg" />
            <div className="h-14 w-24 rounded border-[1.5px] border-ink/10 bg-wk-bg" />
            <div className="h-14 w-24 rounded border-[1.5px] border-ink/10 bg-wk-bg" />
            <div className="h-14 w-24 rounded border-[1.5px] border-ink/10 bg-wk-bg" />
          </div>
        </div>
      </div>

      {/* Body slab placeholders */}
      <div className="px-4 pb-[34px] pt-[18px] sm:px-[30px] sm:pb-[60px] sm:pt-6">
        <SkeletonSlab />
        <SkeletonSlab />
      </div>
    </div>
  )
}
