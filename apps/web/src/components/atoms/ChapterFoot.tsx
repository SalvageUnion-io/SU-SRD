import type { CSSProperties, ReactNode } from 'react'
import { Speckle } from './Speckle'

/**
 * ChapterFoot — the band across the foot of a Workshop Manual page (ruleset,
 * "The source" 2): the site `Footer`'s one band, where every page of both
 * tools ends, a row of two ends: `start` (an entity page's citation, then the
 * licence) and `end` (the site's own links and the mark).
 *
 * It wears the colour of the band the page leads with, as the Union bar does
 *: its ground, foreground and grain are the
 * `--su-foot-*` properties (`.su-chapter-foot` in `styles/partials/shell.css`),
 * ink with paper flecks until the leading band's rule sets them to its own
 * (`footerMatchCss`, `unionBarMatch.ts`). The band cannot reach the foot
 * through the cascade (they are siblings), so the rule is keyed on it, and a
 * static page, no JS, matches too. Both grains are served; the ground's shows.
 *
 * A foot band carries TEXT, never chips (hard rule R4).
 */

export type ChapterFootProps = {
  /**
   * The page's source, on its own cut-out: the page's ground hanging from the
   * band's top edge at the row's end, above the site links.
   */
  cite?: ReactNode
  /** The licence, at the row's start. */
  start?: ReactNode
  /** The site links and the mark, at the row's end. */
  end?: ReactNode
  /** The inner row's max inline size, matching the band at the page's head. */
  measure?: string
}

const ROOT = {
  isolation: 'isolate',
  position: 'relative',
  width: '100%',
} satisfies CSSProperties

export function ChapterFoot({ cite, start, end, measure }: ChapterFootProps) {
  return (
    <div
      className="su-chapter-foot"
      // A foot band is text, never chips (hard rule R4): `chip-strips.e2e.ts` reads it.
      data-foot-band=""
      style={ROOT}
    >
      <span className="su-chapter-foot__grain su-chapter-foot__grain--paper">
        <Speckle grain="paper" />
      </span>
      <span className="su-chapter-foot__grain su-chapter-foot__grain--ink">
        <Speckle grain="ink" />
      </span>
      {cite != null && (
        <div className="su-chapter-foot__cite" style={measure ? { maxWidth: measure } : undefined}>
          {cite}
        </div>
      )}
      <div className="su-chapter-foot__row" style={measure ? { maxWidth: measure } : undefined}>
        {start != null && <div className="su-chapter-foot__start">{start}</div>}
        {end != null && <div className="su-chapter-foot__end">{end}</div>}
      </div>
    </div>
  )
}
