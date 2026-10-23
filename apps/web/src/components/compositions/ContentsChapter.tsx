import type { MouseEvent } from 'react'
import type { ChapterTone } from '../atoms/chapterBandColor'
import { CHAPTER_BAND_COLOR } from '../atoms/chapterBandColor'
import { ToneStrip } from '../atoms/ToneStrip'

/**
 * One chapter of the Contents: the manual's chapter opened by a band
 * in its colour, then its name and real entry count, then its rows, each a
 * plain link with its count. The SRD home page's index draws these, and the
 * Mediator's Reference draws the same chapters inside Play (`SrdExplorer`),
 * and the Union bar's phone drawer its index (`NavDrawer`).
 *
 * Every row is a real link to its page. A row with `onOpen` opens in place
 * instead on a plain click (a host that must not leave its screen, Play),
 * while a middle- or modified click still follows the link.
 *
 * Compacts are 36px for a fine pointer and 44px under `(pointer: coarse)` or on a
 * phone width (the touch floor, ruleset §4.6): `shared.css`'s
 * `.su-contents__row`, which both apps load.
 */

/** One row of the index: an entry and, for a chapter's catalog, its count. */
export type ContentsRow = {
  label: string
  href: string
  count?: number
  /** Where a book prints it (`p.14`), in the count's place: the Starter Set landing's chapter maps. */
  page?: string
  /** Open the row in place on a plain click, rather than following `href`. */
  onOpen?: () => void
}

export type ContentsChapterProps = {
  id: string
  title: string
  /** The band's colour: a chapter's tone, or ink for a section of rules. */
  tone: ChapterTone | 'ink'
  rows: ContentsRow[]
  total?: number
  /** Called as any row is followed (the nav drawer closes on it). */
  onFollow?: () => void
}

/** A plain left click, the one an in-place open takes over. */
function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/** One section of the index: its colour band; its name and count; its rows. */
export function ContentsChapter({ id, title, tone, rows, total, onFollow }: ContentsChapterProps) {
  const headingId = `${id}-heading`
  return (
    <section id={id} className="su-contents__chapter" aria-labelledby={headingId}>
      <ToneStrip color={tone === 'ink' ? 'var(--color-ink)' : CHAPTER_BAND_COLOR[tone]} />
      <h2 id={headingId} className="su-contents__heading">
        <span>{title}</span>
        {total !== undefined && <span className="su-contents__total">{total}</span>}
      </h2>
      <ul className="su-contents__rows">
        {rows.map((row) => (
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
              {(row.count ?? row.page) !== undefined && (
                <span className="su-contents__count">{row.count ?? row.page}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
