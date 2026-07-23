/**
 * SheetSkeleton — shimmer placeholder for /sheet/:kind/:id while the route
 * loader hydrates the entity store (design review U-2).
 *
 * Mirrors the LiveSheet shell (sticky top bar → hero band → body slabs) so
 * the swap to the real sheet doesn't shift the page: same min-h-[58px] bar,
 * same horizontal padding rhythm, hero-sized frame, then two slab groups
 * (dashed-leader header + card placeholders). Ghost bars come from the shared
 * `Skeleton` atom (§0: one skeleton implementation), sized per region here.
 */

import { Ghost } from '../skeleton/Skeleton'

function SkeletonSlab() {
  return (
    <div className="mt-7 first:mt-0">
      {/* Slab header: label + dashed leader (component-lib `Slab` shape) */}
      <div className="mb-3.5 flex items-center gap-3">
        <Ghost className="h-4 w-28 bg-ink/15" />
        <Ghost className="h-0.5 flex-1" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-20 rounded-panel border-chrome border-ink/15 bg-paper" />
        <div className="h-20 rounded-panel border-chrome border-ink/15 bg-paper" />
      </div>
    </div>
  )
}

export function SheetSkeleton() {
  return (
    <div role="status" aria-label="Loading sheet" className="min-h-screen animate-pulse bg-wk-bg">
      {/* Sticky-bar placeholder (LiveSheet top bar footprint) */}
      <div className="flex min-h-[58px] items-center gap-4 border-b-2 border-ink/20 px-4 py-2 sm:px-[30px]">
        <Ghost className="h-4 w-24 bg-ink/15" />
        <div className="ml-auto flex items-center gap-2.5">
          <div className="h-7 w-16 rounded-card border-chrome border-ink/10 bg-paper" />
          <div className="h-7 w-16 rounded-card border-chrome border-ink/10 bg-paper" />
        </div>
      </div>

      {/* Hero band placeholder */}
      <div className="px-4 pb-1.5 pt-4 sm:px-[30px] sm:pt-[22px]">
        <div className="rounded-panel border-entity border-ink/20 bg-paper p-5 sm:p-6">
          <Ghost className="h-8 w-1/2 bg-ink/15 sm:w-2/5" />
          <Ghost className="mt-3 h-4 w-1/3" />
          <div className="mt-6 flex flex-wrap gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: ghost tiles are positional
                key={i}
                className="h-14 w-24 rounded border-chrome border-ink/10 bg-wk-bg"
              />
            ))}
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
