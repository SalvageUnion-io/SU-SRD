import type { ReactNode } from 'react'
import { DOC_PAGE, docMeasure } from '../lib/docPageStyles'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { ChapterBand } from './index'

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
  children,
}: {
  title: string
  /** The reading column's width, left-aligned on the page's gutter. */
  measure: '48rem' | '64rem'
  /** The gap between the body's blocks. */
  gap: string
  children: ReactNode
}) {
  return (
    <div style={DOC_PAGE}>
      <ChapterBand measure={PAGE_MEASURE}>{title}</ChapterBand>
      <div className="su-page-body">
        <div style={docMeasure(measure, gap)}>{children}</div>
      </div>
    </div>
  )
}
