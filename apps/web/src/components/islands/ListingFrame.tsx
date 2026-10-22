import type { ReactNode } from 'react'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import type { BreadcrumbItem } from '../atoms/BreadcrumbTrail'
import type { ChapterTone } from '../atoms/chapterBandColor'
import { BreadcrumbTrail, ChapterBand, ChapterBandTrail } from '../index'

/**
 * The page's chapter band, drawn by the island so the rail can sit on it: the
 * listing's search and filters are the band's controls (`asideAt="controls"`),
 * beside the name while they fit and wrapping up over it when they do not.
 * The island mounts with `createRoot`, outside the layout's tree, so the
 * band's trail comes as a prop rather than from `ChapterBandTrail`.
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
 * With a band, the page's head and body: the band with the rail as its
 * controls, then the listing on the page ground. Without one, the listing
 * alone, its rail heading it.
 */
export function ListingFrame({
  band,
  rail,
  children,
}: {
  band: ListingBand | undefined
  rail: ReactNode
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
          aside={rail || undefined}
        >
          {band.title}
        </ChapterBand>
      </ChapterBandTrail.Provider>
      <div className="su-listing-page su-page-body">{children}</div>
    </>
  )
}
