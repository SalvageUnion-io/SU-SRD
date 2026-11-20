import type { ReactNode } from 'react'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import type { BreadcrumbItem } from '../atoms/BreadcrumbTrail'
import type { ChapterTone } from '../atoms/chapterBandColor'
import { BreadcrumbTrail, ChapterBand, ChapterBandTrail } from '../index'

/**
 * The page's chapter band, drawn by the island so the view toggle can sit on
 * it: a listing's band holds its name and the List | Catalog toggle alone
 * (ledger L10); the search, the facets and what is filtered are one bar at
 * the top of the list. The island mounts with `createRoot`, outside the
 * layout's tree, so the band's trail comes as a prop rather than from
 * `ChapterBandTrail`.
 */
export type ListingBand = {
  /** The schema's plural name, notched into the band. */
  title: string
  tone: ChapterTone
  /** The band colour when the listing wears its own rather than its chapter's (`listingBandFillFor`). */
  fill?: string
  /** The page's breadcrumbs, root-relative, the page itself last. */
  trail: BreadcrumbItem[]
}

/**
 * With a band, the page's head and body: the band with the view toggle as its
 * one control, then the filter bar and the listing on the page ground.
 * Without one, the listing alone, its whole rail heading it.
 */
export function ListingFrame({
  band,
  view,
  filters,
  children,
}: {
  band: ListingBand | undefined
  /** The List | Catalog toggle, the band's one control. */
  view: ReactNode
  /** The search, the facets and what is filtered: the bar at the top of the list. */
  filters: ReactNode
  children: ReactNode
}) {
  if (!band) return children
  return (
    <>
      <ChapterBandTrail.Provider
        value={
          band.trail.length > 1 && <BreadcrumbTrail breadcrumbs={band.trail} placement="band" />
        }
      >
        <ChapterBand
          tone={band.tone}
          fill={band.fill}
          measure={PAGE_MEASURE}
          asideAt="controls"
          aside={view || undefined}
        >
          {band.title}
        </ChapterBand>
      </ChapterBandTrail.Provider>
      <div className="su-listing-page su-page-body">
        {filters && <div className="su-listing-page__filters">{filters}</div>}
        {children}
      </div>
    </>
  )
}
