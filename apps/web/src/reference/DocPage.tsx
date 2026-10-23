import type { ReactNode } from 'react'
import { ChapterBand } from '../components/index'
import { DOC_PAGE, docMeasure } from '../lib/docPageStyles'
import { PAGE_MEASURE } from '../lib/pageMeasure'

/**
 * DocPage — the frame every plain document page wears (`/about`, `/api`,
 * `/changelog`, `/bot` and its two policies): the page column, its
 * `ChapterBand` title, then the body on the one page measure the band shares
 * (`.su-page-body`), its text in a reading column from the same gutter.
 */
export function DocPage({
  title,
  measure,
  gap,
  fill,
  controls,
  sidebar,
  userMade = false,
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
  /** A column beside the reading column on a wide screen (`.su-doc-page__grid`), after it on a narrow one. */
  sidebar?: ReactNode
  /** The band's hatch for players' own things (ruleset §3.9): `/homebrew`. */
  userMade?: boolean
  children: ReactNode
}) {
  return (
    <div style={DOC_PAGE}>
      <ChapterBand
        measure={PAGE_MEASURE}
        userMade={userMade}
        {...(fill ? { fill } : {})}
        {...(controls ? { aside: controls, asideAt: 'controls' as const } : {})}
      >
        {title}
      </ChapterBand>
      <div className="su-page-body">
        {sidebar ? (
          <div className="su-doc-page__grid">
            <div style={docMeasure(measure, gap)}>{children}</div>
            <aside className="su-doc-page__sidebar">{sidebar}</aside>
          </div>
        ) : (
          <div style={docMeasure(measure, gap)}>{children}</div>
        )}
      </div>
    </div>
  )
}
