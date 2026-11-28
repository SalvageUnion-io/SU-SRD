import type { MouseEvent } from 'react'
import { cn } from '../../lib/cn'
import { capsLabel } from '../atoms/capsLabel'
import type { ChapterTone } from '../atoms/chapterBandColor'
import { CHAPTER_BAND_COLOR } from '../atoms/chapterBandColor'
import { ToneStrip } from '../atoms/ToneStrip'

/** A sub-head's small caps (ruleset §3.12). */
const GROUP_CAPS = capsLabel({ size: 'caption', weight: 'bold', tracking: 'snug' })

/**
 * One chapter of the Contents: the manual's chapter opened by a band
 * in its colour, then its name, then its rows, each a plain link. The SRD home page's index draws these, and the
 * Mediator's Reference draws the same chapters inside Play (`SrdExplorer`),
 * and the Union bar's phone drawer its index (`NavDrawer`).
 *
 * Every row is a real link to its page. A row with `onOpen` opens in place
 * instead on a plain click (a host that must not leave its screen, Play),
 * while a middle- or modified click still follows the link.
 *
 * Compacts are 36px for a fine pointer and 44px under `(pointer: coarse)` or on a
 * phone width (a thumb's row, ruleset §4.6): `shared.css`'s
 * `.su-contents__row`, which both apps load.
 */

/** One row of the index: an entry. */
export type ContentsRow = {
  label: string
  href: string
  /** Where a book prints it (`p.14`): the Starter Set landing's chapter maps. */
  page?: string
  /** The entry's one stat (`SP 12`): a chapter's index, a stat a name (RR-18). */
  stat?: string
  /** Open the row in place on a plain click, rather than following `href`. */
  onOpen?: () => void
}

/** A run of rows under a small caps sub-head (a tech level, a tree, a letter). */
export type ContentsGroup = { label: string; rows: ContentsRow[] }

export type ContentsChapterProps = {
  id: string
  title: string
  /** The band's colour: a chapter's tone, or ink for a section of rules. */
  tone: ChapterTone | 'ink'
  rows: ContentsRow[]
  /** The rows broken up under sub-heads; when given, `rows` is unused. */
  groups?: ContentsGroup[]
  /** The section's own page (its full list): its title links there. */
  href?: string
  /** Called as any row is followed (the nav drawer closes on it). */
  onFollow?: () => void
}

/** A run longer than this takes columns of its own under its sub-head in a flowing index. */
const LONG_RUN = 12

/** A plain left click, the one an in-place open takes over. */
function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/** One section of the index: its colour band; its name; its rows. */
export function ContentsChapter({
  id,
  title,
  tone,
  rows,
  groups,
  href,
  onFollow,
}: ContentsChapterProps) {
  const headingId = `${id}-heading`
  const renderRows = (list: ContentsRow[]) => (
    <ul className="su-contents__rows">
      {list.map((row) => (
        <li key={row.href}>
          <a
            href={row.href}
            className="su-contents__row"
            onClick={(event) => {
              onFollow?.()
              if (!row.onOpen || !isPlainClick(event)) return
              event.preventDefault()
              row.onOpen()
            }}
          >
            <span>{row.label}</span>
            {row.page !== undefined && <span className="su-contents__page">{row.page}</span>}
            {row.stat !== undefined && <span className="su-contents__page">{row.stat}</span>}
          </a>
        </li>
      ))}
    </ul>
  )
  return (
    <section id={id} className="su-contents__chapter" aria-labelledby={headingId}>
      <ToneStrip color={tone === 'ink' ? 'var(--color-ink)' : CHAPTER_BAND_COLOR[tone]} />
      <h2 id={headingId} className="su-contents__heading">
        {href ? (
          <a href={href} className="su-contents__title-link" onClick={() => onFollow?.()}>
            {title}
          </a>
        ) : (
          <span>{title}</span>
        )}
      </h2>
      <div className="su-contents__body">
        {groups
          ? groups.map((group) => (
              <section
                key={group.label}
                className={cn(
                  'su-contents__group',
                  group.rows.length > LONG_RUN && 'su-contents__group--long'
                )}
                aria-label={group.label}
              >
                <h3 className={cn('su-contents__group-head', GROUP_CAPS)}>{group.label}</h3>
                {renderRows(group.rows)}
              </section>
            ))
          : renderRows(rows)}
      </div>
    </section>
  )
}
