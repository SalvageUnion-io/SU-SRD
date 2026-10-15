import type { ComponentProps } from 'react'
import type { ChapterTone } from '../ui/index'
import { buttonVariants, CHAPTER_BAND_COLOR, cn, StartHere } from '../ui/index'

/**
 * The home page as the manual's Contents page (board 06): the book's chapters
 * as an index, each opened by a band in its colour, then its name and real
 * entry count — no artwork: the index is a contents page, not a gallery; then the
 * rules a table reaches for under an ink band, set as CSS columns (a masonry
 * that leaves no hole under a short chapter); and "Start here" with the Discord
 * bot's button under it in a right-hand sidebar. On a phone "Start here" and the
 * button follow the index. Server-rendered and
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
 * adds no foot of its own: the Union bar's Build tab is the way into the Cantina.
 */
export function HomeStartHere({
  guideHrefs,
}: {
  /** Each step's creation guide in the book, by step. */
  guideHrefs: ComponentProps<typeof StartHere>['hrefs']
}) {
  return <StartHere id="start-here" hrefs={guideHrefs} />
}

/** Discord's mark (Simple Icons, CC0), drawn in the button's text colour. */
const DISCORD_MARK =
  'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z'

/**
 * The SalvageUnion.io Discord bot, offered straight under "Start here": one full-size
 * button in Discord's blurple (a one-off exception to the tone palette, owner's
 * call 2026-10-14) with Discord's mark, opening the bot's install link. The
 * site footer links `/discord`, which documents the commands.
 */
export function DiscordButton({ installHref }: { installHref: string }) {
  return (
    <a
      href={installHref}
      target="_blank"
      rel="noopener noreferrer"
      id="discord-bot"
      className={cn(buttonVariants({ variant: 'ink', size: 'full' }), 'srd-home__discord')}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        className="srd-home__discord-mark"
      >
        <path fill="currentColor" d={DISCORD_MARK} />
      </svg>
      SalvageUnion.io On Discord
    </a>
  )
}
