import type { CSSProperties, ReactNode } from 'react'
import { CHAPTER_REFS } from '../lib/chapters'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { CHAPTER_BAND_COLOR, ChapterBand, Slab, ToneStrip } from './index'

/** A section's slab: the section's own gap spaces it. */
const SLAB = { marginBottom: 0 } satisfies CSSProperties

type NotFoundProps = {
  /**
   * The hero search in the band: the `SearchIsland` island over its server
   * markup on the static page, the same component rendered live in the app.
   */
  search: ReactNode
  /** The "did you mean" (`DidYouMeanIsland`), the same way. */
  didYouMean: ReactNode
  /** An exit back into the app it was opened from (the app's Hangar). */
  back?: ReactNode
}

/**
 * The not-found content, one for the whole site: the rules-blue band with the
 * hero search in it; under it the "did you mean" (the missed slug run against
 * the SRD's search index) and the book's five chapters, each a link to its
 * section of the Contents. Every link is ink on paper: a chapter's colour is
 * its top band, as on the home index, never a text ground (ruleset §3.8) or a
 * left rail (§3.10).
 *
 * The static `/404` page and the app's unmatched route both draw it; the
 * host supplies the search and the guesses, since a page hydrates islands and
 * the app renders them.
 */
export function NotFound({ search, didYouMean, back }: NotFoundProps) {
  return (
    <div className="su-not-found">
      <div className="su-not-found__band">
        <ChapterBand
          measure={PAGE_MEASURE}
          aside={
            <div className="su-not-found__lede">
              <p>
                <strong>404 · Salvage operation failed.</strong> This page was broken down,
                relocated, or never existed. Search the SRD for it, or open a chapter.
              </p>
              {search}
            </div>
          }
        >
          Page not found
        </ChapterBand>
      </div>
      <div className="su-not-found__body su-page-body">
        {back}
        {didYouMean}
        <nav className="su-not-found__chapters" aria-labelledby="not-found-chapters">
          <Slab
            variant="solid"
            as="h2"
            id="not-found-chapters"
            label="Or open a chapter"
            style={SLAB}
          />
          <ul className="su-not-found__chapter-list">
            {CHAPTER_REFS.map((chapter) => (
              <li key={chapter.id}>
                {/* The home index's chapter column: a top band in the
                    chapter's colour over its name (ruleset §3.10: colour
                    rides in top bands, never a left rail). */}
                <a href={chapter.href} className="su-not-found__chapter">
                  <ToneStrip color={CHAPTER_BAND_COLOR[chapter.tone]} />
                  <span className="su-not-found__chapter-name">{chapter.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
