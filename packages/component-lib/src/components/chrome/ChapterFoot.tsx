import type { CSSProperties, ElementType, ReactNode } from 'react'
import { borderWidth, color } from '../../design/tokens'
import type { ChapterTone } from './chapterBandColor'
import { CHAPTER_BAND_COLOR } from './chapterBandColor'
import type { SpeckleGrain } from './Speckle'
import { Speckle } from './Speckle'

/**
 * ChapterFoot — the band across the foot of a Workshop Manual page (ruleset,
 * "The source": "The foot band carries the citation (page and section)"). The
 * same chapter colour and ink speckle as the `ChapterBand` at the page's head,
 * an ink rule along its top, and a row of two ends: `start` (the page number,
 * set large) and `end` (the book and section, or the site's own links).
 *
 * The SRD wears it twice: an entity page closes on its citation (board 07,
 * "p.112 · Salvage Union Workshop Manual"), and the site footer is the
 * Contents chapter's foot band (board 06).
 *
 * A foot band carries TEXT, so its colours are the ones text reads on (ruleset
 * §3.8, "ink on colour"): ink on the rules blue, pilot and mech; paper on the
 * Denizens navy; and on Union Crawler pages the deeper `crawlerBand` pink with
 * paper, because the head band's crawler pink carries neither ink (4.2:1) nor
 * paper (3.7:1) at 4.5:1. Applied here rather than left to the caller.
 */

/** The band behind text: the chapter's colour, or its text-bearing shade. */
const FOOT_BAND: Record<ChapterTone, { background: string; text: string }> = {
  rules: { background: CHAPTER_BAND_COLOR.rules, text: color.ink },
  pilot: { background: CHAPTER_BAND_COLOR.pilot, text: color.ink },
  mech: { background: CHAPTER_BAND_COLOR.mech, text: color.ink },
  crawler: { background: color.crawlerBand, text: color.paper },
  denizen: { background: CHAPTER_BAND_COLOR.denizen, text: color.paper },
  ink: { background: CHAPTER_BAND_COLOR.ink, text: color.paper },
}

export type ChapterFootProps = {
  /** The page number (or the copyright line), at the row's start. */
  start?: ReactNode
  /** The book and section (or the site links), at the row's end. */
  end?: ReactNode
  /** Which chapter of the book the page belongs to. Defaults to `rules`. */
  tone?: ChapterTone
  /**
   * The band colour, for a ground outside the chapter map — the Union bar's
   * `inkDeep`, when an ink foot bookends it. Overrides `tone`'s colour; the
   * text colour still follows `tone`.
   */
  fill?: string
  /** The speckle: `ink` grain on a colour band, `paper` flecks on ink (default follows `tone`, §3.5). */
  grain?: SpeckleGrain
  /** The inner row's max inline size, matching the band at the page's head. */
  measure?: string
  /** The element. `footer` for the site footer; `div` inside a page's `main`. */
  as?: ElementType
  /** Accessible name, when the band is a landmark. */
  'aria-label'?: string
}

const ROOT = {
  borderTopColor: color.ink,
  borderTopStyle: 'solid',
  borderTopWidth: borderWidth.chrome,
  isolation: 'isolate',
  position: 'relative',
  width: '100%',
} satisfies CSSProperties

export function ChapterFoot({
  start,
  end,
  tone = 'rules',
  fill,
  grain,
  measure,
  as: Tag = 'div',
  'aria-label': ariaLabel,
}: ChapterFootProps) {
  return (
    <Tag
      className="su-chapter-foot"
      aria-label={ariaLabel}
      style={{
        ...ROOT,
        backgroundColor: fill ?? FOOT_BAND[tone].background,
        color: FOOT_BAND[tone].text,
      }}
    >
      <Speckle grain={grain ?? (tone === 'ink' ? 'paper' : 'ink')} />
      <div className="su-chapter-foot__row" style={measure ? { maxWidth: measure } : undefined}>
        {start != null && <div className="su-chapter-foot__start">{start}</div>}
        {end != null && <div className="su-chapter-foot__end">{end}</div>}
      </div>
    </Tag>
  )
}
