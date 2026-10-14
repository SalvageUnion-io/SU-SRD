import type { ChapterTone } from 'component-lib'
import { buttonVariants, CHAPTER_BAND_COLOR, StartHere, TILE_NAME } from 'component-lib'
import type { ComponentProps } from 'react'

/**
 * The home page as the manual's Contents page (board 06): the book's chapters
 * as an index, each opened by a band in its colour, then its name and real
 * entry count — no artwork: the index is a contents page, not a gallery; then the
 * rules a table reaches for under an ink band, set as CSS columns (a masonry
 * that leaves no hole under a short chapter); "Start here" in a right-hand
 * sidebar; and the Discord bot under "Start here" while the index runs two
 * columns, or as a band across the foot once it runs three. On a phone "Start
 * here" leads the stack and the Discord bot follows the index. Server-rendered and
 * static: every row is a plain link.
 *
 * Rows are 36px for a fine pointer and 44px under `(pointer: coarse)` or on a phone width (the
 * repo's touch floor, ruleset §4.6) — `global.css`'s `.srd-contents__row`.
 */

/** One row of the index: an entry and, for a chapter's catalog, its count. */
export type ContentsRow = { label: string; href: string; count?: number }

type ContentsChapterProps = {
  id: string
  title: string
  /** The band's colour: a chapter's tone, or ink for a section of rules. */
  tone: ChapterTone | 'ink'
  rows: ContentsRow[]
  total?: number
}

/** One section of the index: its colour band; its name and count; its rows. */
export function ContentsChapter({ id, title, tone, rows, total }: ContentsChapterProps) {
  const headingId = `${id}-heading`
  return (
    <section id={id} className="srd-contents__chapter" aria-labelledby={headingId}>
      <div
        aria-hidden="true"
        className="srd-contents__band"
        style={{ backgroundColor: tone === 'ink' ? 'var(--color-ink)' : CHAPTER_BAND_COLOR[tone] }}
      />
      <h2 id={headingId} className="srd-contents__heading">
        <span>{title}</span>
        {total !== undefined && <span className="srd-contents__total">{total}</span>}
      </h2>
      <ul className="srd-contents__rows">
        {rows.map((row) => (
          <li key={row.href}>
            <a href={row.href} className="srd-contents__row">
              <span>{row.label}</span>
              {row.count !== undefined && <span className="srd-contents__count">{row.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The path in for a new player: the shared "Start here" block both tools show
 * (`StartHere`), each step opening its creation guide in the book. The SRD
 * adds no foot of its own: the Union bar's Build tab is the way into ITUN.
 */
export function HomeStartHere({
  guideHrefs,
}: {
  /** Each step's creation guide in the book, by step. */
  guideHrefs: ComponentProps<typeof StartHere>['hrefs']
}) {
  return <StartHere id="start-here" hrefs={guideHrefs} />
}

/**
 * The SURef Discord bot, offered beside the index: a catalog tile that is all
 * band, in Discord's blurple (a one-off exception to the tone palette, owner's
 * call 2026-10-14), its name on the cut-out and the install button at full
 * size beside it. The site footer links `/discord`, which documents the
 * commands.
 */
export function DiscordBot({ installHref }: { installHref: string }) {
  return (
    <section className="su-entity-tile su-entity-tile--bare" aria-labelledby="discord-bot">
      <div className="su-entity-tile__frame">
        <div
          className="su-entity-tile__band su-grain--paper srd-discord__band"
          data-grain="paper"
          style={{ backgroundColor: 'var(--color-discord)', columnGap: 'var(--space-6)' }}
        >
          <span className="su-entity-tile__notch">
            <h2 id="discord-bot" className="su-entity-tile__name" style={TILE_NAME}>
              Roll on Discord
            </h2>
          </span>
          <span className="su-entity-tile__chips">
            <a
              href={installHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'ink', size: 'full' })}
            >
              Add to Discord
            </a>
          </span>
        </div>
      </div>
    </section>
  )
}
