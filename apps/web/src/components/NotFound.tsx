import type { ReactNode } from 'react'
import { CHAPTER_REFS } from '../lib/chapters'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { componentsCopy } from '../messages/components'
import { CHAPTER_BAND_COLOR, ChapterBand, Slab, ToneStrip } from './index'
import { GREY_HEADER } from './referenceEntity/card/cardChrome'

type NotFoundProps = {
  /**
   * The hero search in the band: the `SearchIsland` island over its server
   * markup on the static page, the same component rendered live in the app.
   */
  search: ReactNode
  /** The "did you mean" (`DidYouMeanIsland`), the same way. */
  didYouMean: ReactNode
  /** An exit back into the app it was opened from (the app's Training Bay). */
  back?: ReactNode
}

/**
 * The not-found content, one for the whole site: the null band (grey: the
 * page is no chapter's) with its title alone; in the body, the message at
 * body size and the search, then the "did you mean" (the missed slug run against
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
      {/* The search is the band's control, as an index's is (R37); on a
          phone it leads the body, full
          width, above the 404's words. */}
      <ChapterBand
        measure={PAGE_MEASURE}
        fill={GREY_HEADER}
        aside={<div className="su-not-found__search">{search}</div>}
        asideAt="controls"
      >
        {componentsCopy('pageNotFound')}
      </ChapterBand>
      <div className="su-not-found__body su-page-body">
        <p className="su-not-found__lede">
          <strong>{componentsCopy('n404SalvageOperationFailed')}</strong> This page was broken down,
          relocated, or never existed. Search the Reference for it, or open a chapter.
        </p>
        {back}
        {didYouMean}
        <nav className="su-not-found__chapters" aria-labelledby="not-found-chapters">
          <Slab as="h2" id="not-found-chapters" label={componentsCopy('orOpenAChapter')} flush />
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
