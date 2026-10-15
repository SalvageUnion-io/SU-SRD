/**
 * `/404` — the not-found page, as a search page.
 *
 * The rules-blue band with the home page's hero search in it; under it the
 * "did you mean" (`DidYouMeanIsland`, the missed slug run against the SRD's
 * search index) and the book's five chapters, each a link to its section of
 * the Contents. Every link is ink on paper: a chapter's colour is its top band,
 * as on the home index, never a text ground (ruleset §3.8) or a left rail (§3.10).
 *
 * Emitted as `dist/404.html`, NOT `dist/404/index.html`: the Worker answers every
 * miss with it (`src/worker/index.ts`, reading `/404` through the asset binding).
 * See the URL -> file table in `ssg/DESIGN.md`. The band's search is the page's
 * search, so the Union bar carries none here (`BaseLayout`).
 */

import type { CSSProperties } from 'react'
import type { PageModule, PageResult } from '../../ssg/types'
import { HeroSearchStatic } from '../components/HeroSearch'
import { CHAPTER_BAND_COLOR, ChapterBand, Slab } from '../components/index'
import { buildChapters } from '../lib/chapters'
import { TITLE_SUFFIX } from '../lib/constants'
import '../lib/gameData'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { Island } from '../runtime/Island'

/** A section's slab: the section's own gap spaces it. */
const SLAB = { marginBottom: 0 } satisfies CSSProperties

function page(): PageResult {
  const chapters = buildChapters()

  return {
    meta: {
      title: `404 - Page Not Found${TITLE_SUFFIX}`,
      description: 'The page you are looking for could not be found.',
      noindex: true,
    },
    children: (
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
                <Island name="SearchIsland" client="interaction" ssr props={{ variant: 'hero' }}>
                  <HeroSearchStatic />
                </Island>
              </div>
            }
          >
            Page not found
          </ChapterBand>
        </div>
        <div className="su-not-found__body su-page-body">
          <Island name="DidYouMeanIsland" client="idle" />
          <nav className="su-not-found__chapters" aria-labelledby="not-found-chapters">
            <Slab
              variant="solid"
              as="h2"
              id="not-found-chapters"
              label="Or open a chapter"
              style={SLAB}
            />
            <ul className="su-not-found__chapter-list">
              {chapters.map((chapter) => (
                <li key={chapter.id}>
                  {/* The home index's chapter column: a top band in the
                      chapter's colour over its name (ruleset §3.10: colour
                      rides in top bands, never a left rail). */}
                  <a href={chapter.href} className="su-not-found__chapter">
                    <span
                      aria-hidden="true"
                      className="su-contents__band"
                      style={{ backgroundColor: CHAPTER_BAND_COLOR[chapter.tone] }}
                    />
                    <span className="su-not-found__chapter-name">{chapter.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    ),
  }
}

export const notFoundPage: PageModule = {
  pattern: '/404',
  page,
}
