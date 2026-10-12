import type { ChapterTone } from 'component-lib'
import { buttonVariants, CHAPTER_BAND_COLOR } from 'component-lib'

/**
 * The home page as the manual's Contents page (board 06): the "New to the
 * Union?" path, then the book's chapters as an index, each headed by a band
 * in its colour with its real entry count, then the rules a table reaches for
 * under an ink band, and the Discord bot. They are siblings in one
 * `.srd-home__body`, set as CSS columns (a masonry that leaves no hole under
 * a short chapter) on a wide screen and one stack on a phone — one DOM order,
 * so reading and tab order follow what you see. Server-rendered and static:
 * every row is a plain link.
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

/** One section of the index: its colour band, its name and count, its rows. */
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

export type NewToTheUnionStep = {
  title: string
  /** The chapter and pages the step walks through. */
  meta: string
  /** The guide that walks it. */
  href: string
}

type NewToTheUnionProps = {
  steps: NewToTheUnionStep[]
  /** Where "Build a pilot" hands off: ITUN. */
  buildHref: string
}

/**
 * The path in for a new player: Create a Pilot, then a Mech, then a Crawler,
 * each opening its guide, and the hand-off to In The Union Now, which turns
 * those pages into a live sheet.
 */
export function NewToTheUnion({ steps, buildHref }: NewToTheUnionProps) {
  return (
    <section className="srd-panel" aria-labelledby="new-to-the-union">
      <h2 id="new-to-the-union" className="srd-panel__heading">
        New to the Union?
      </h2>
      <ol className="srd-steps">
        {steps.map((step, index) => (
          <li key={step.href}>
            <a href={step.href} className="srd-steps__step">
              <span aria-hidden="true" className="srd-steps__numeral">
                {index + 1}
              </span>
              <span className="srd-steps__text">
                <span className="srd-steps__title">{step.title}</span>
                <span className="srd-steps__meta">{step.meta}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
      <div className="srd-panel__foot">
        <p>Ready to build? In The Union Now turns these pages into a live sheet for your crew.</p>
        <a
          href={buildHref}
          className={`${buttonVariants({ variant: 'primary', size: 'full' })} srd-panel__cta`}
        >
          Build a pilot
        </a>
      </div>
    </section>
  )
}

/**
 * The SURef Discord bot, offered beside the index: the same lookups and every
 * table, rolled in the crew's own server. Installs from here; `/discord`
 * documents the commands.
 */
export function DiscordBot({ installHref, aboutHref }: { installHref: string; aboutHref: string }) {
  return (
    <section className="srd-panel" aria-labelledby="discord-bot">
      <h2 id="discord-bot" className="srd-panel__heading">
        Roll on Discord
      </h2>
      <div className="srd-panel__body">
        <p>
          The SURef bot brings this reference to your table&rsquo;s server: roll on every Salvage
          Union table and look up any chassis, system or module with <code>/su</code>.
        </p>
        <p>Free, no account, and it asks for no server permissions.</p>
      </div>
      <div className="srd-panel__foot srd-panel__foot--row">
        <a
          href={installHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonVariants({ variant: 'primary', size: 'full' })} srd-panel__cta`}
        >
          Add to Discord
        </a>
        <a href={aboutHref} className="srd-panel__link">
          See the commands
        </a>
      </div>
    </section>
  )
}
