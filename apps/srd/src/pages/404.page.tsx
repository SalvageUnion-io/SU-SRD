/**
 * `/404` — the not-found page, as a search page.
 *
 * The rules-blue band with the home page's hero search in it; under it the
 * "did you mean" (`DidYouMeanIsland`, the missed slug run against the SRD's
 * search index) and the book's five chapters, each a link to its section of
 * the Contents. Every link is ink on paper: a chapter's colour is its swatch,
 * never a text ground (ruleset §3.8).
 *
 * Emitted as `dist/404.html`, NOT `dist/404/index.html`: the Worker answers every
 * miss with it (`src/worker/index.ts`, reading `/404` through the asset binding).
 * See the URL -> file table in `ssg/DESIGN.md`. The band's search is the page's
 * search, so the Union bar carries none here (`BaseLayout`).
 */

import { CHAPTER_BAND_COLOR, ChapterBand } from 'component-lib'
import type { PageModule, PageResult } from '../../ssg/types'
import { HeroSearchStatic } from '../components/HeroSearch'
import { buildChapters } from '../lib/chapters'
import { TITLE_SUFFIX } from '../lib/constants'
import '../lib/gameData'
import { Island } from '../runtime/Island'

/** The page's measure: the band, the guesses and the chapters share it. */
const MEASURE = '60rem'

function page(): PageResult {
  const chapters = buildChapters()

  return {
    meta: {
      title: `404 - Page Not Found${TITLE_SUFFIX}`,
      description: 'The page you are looking for could not be found.',
      noindex: true,
    },
    children: (
      <div className="srd-not-found">
        <div className="srd-not-found__band">
          <ChapterBand
            measure={MEASURE}
            aside={
              <div className="srd-not-found__lede">
                <p>
                  <strong>404 · Salvage operation failed.</strong> This page was scrapped,
                  relocated, or never existed. Search the SRD for it, or open a chapter.
                </p>
                <Island name="SearchIsland" client="idle" ssr props={{ variant: 'hero' }}>
                  <HeroSearchStatic />
                </Island>
              </div>
            }
          >
            Page not found
          </ChapterBand>
        </div>
        <div className="srd-not-found__body" style={{ maxWidth: MEASURE }}>
          <Island name="DidYouMeanIsland" client="idle" />
          <nav className="srd-not-found__chapters" aria-labelledby="not-found-chapters">
            <h2 id="not-found-chapters" className="srd-not-found__heading">
              Or open a chapter
            </h2>
            <ul className="srd-not-found__chapter-list">
              {chapters.map((chapter) => (
                <li key={chapter.id}>
                  <a href={chapter.href} className="srd-not-found__chapter">
                    <span
                      aria-hidden="true"
                      className="srd-not-found__swatch"
                      style={{ backgroundColor: CHAPTER_BAND_COLOR[chapter.tone] }}
                    />
                    {chapter.title}
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
