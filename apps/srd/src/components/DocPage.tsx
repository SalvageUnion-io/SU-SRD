import { ChapterBand } from 'component-lib'
import type { ReactNode } from 'react'
import { DOC_PAGE, docMeasure } from '../lib/docPageStyles'

/**
 * DocPage — the frame every plain document page wears (`/about`, `/api`,
 * `/changelog`, `/discord` and the two `/bot` policies): the page column, its
 * `ChapterBand` title, then the body in a centred measure the band shares.
 */
export function DocPage({
  title,
  measure,
  gap,
  children,
}: {
  title: string
  measure: '48rem' | '64rem'
  /** The gap between the body's blocks. */
  gap: string
  children: ReactNode
}) {
  return (
    <div style={DOC_PAGE}>
      <ChapterBand measure={measure}>{title}</ChapterBand>
      <div style={docMeasure(measure, gap)}>{children}</div>
    </div>
  )
}
