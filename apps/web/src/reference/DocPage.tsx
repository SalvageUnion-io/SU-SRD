import type { ReactNode } from 'react'
import { ChapterBand } from '../components/index'
import { DOC_PAGE, docMeasure } from '../lib/docPageStyles'
import { PAGE_MEASURE } from '../lib/pageMeasure'

/**
 * DocPage — the frame every plain document page wears (`/about`, `/api`,
 * `/changelog`, `/discord` and the two `/bot` policies): the page column, its
 * `ChapterBand` title, then the body on the one page measure the band shares
 * (`.su-page-body`), its text in a reading column from the same gutter.
 */
export function DocPage({
  title,
  measure,
  gap,
  fill,
  controls,
  children,
}: {
  title: string
  /** The reading column's width, left-aligned on the page's gutter. */
  measure: '48rem' | '64rem'
  /** The gap between the body's blocks. */
  gap: string
  /** The band's colour, in place of the Reference's (the Discord page's blurple). */
  fill?: string
  /** The page's controls on its band, filling the title's line (`asideAt="controls"`). */
  controls?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={DOC_PAGE}>
      <ChapterBand
        measure={PAGE_MEASURE}
        {...(fill ? { fill } : {})}
        {...(controls ? { aside: controls, asideAt: 'controls' as const } : {})}
      >
        {title}
      </ChapterBand>
      <div className="su-page-body">
        <div style={docMeasure(measure, gap)}>{children}</div>
      </div>
    </div>
  )
}
