import type { ChapterTone } from 'component-lib'
import { buttonVariants, CHAPTER_BAND_COLOR, StartHere } from 'component-lib'
import { PRODUCT } from 'component-lib/product'
import type { ComponentProps } from 'react'

/**
 * The home page as the manual's Contents page (board 06): the book's chapters
 * as an index, each opened by a band in its colour and, where the chapter has
 * one, a piece of its artwork, then its name and real entry count; then the
 * rules a table reaches for under an ink band, set as CSS columns (a masonry
 * that leaves no hole under a short chapter); and "Start here" and the Discord
 * bot in a right-hand sidebar. On a phone "Start here" leads the stack and the
 * Discord bot follows the index. Server-rendered and
 * static: every row is a plain link.
 *
 * Rows are 36px for a fine pointer and 44px under `(pointer: coarse)` or on a phone width (the
 * repo's touch floor, ruleset §4.6) — `global.css`'s `.srd-contents__row`.
 */

/** One row of the index: an entry and, for a chapter's catalog, its count. */
export type ContentsRow = { label: string; href: string; count?: number }

/** A chapter opener's artwork: an su-assets master and its width candidates. */
export type ContentsArt = { src: string; srcSet?: string }

/**
 * The art plate's `sizes`. The plate is 10rem tall and the openers' artwork is
 * portrait or near-square, so `object-fit: contain` never draws it wider than
 * the plate is tall: 440w covers it up to a 2x display, 880w beyond.
 */
const ART_SIZES = '10rem'

type ContentsChapterProps = {
  id: string
  title: string
  /** The band's colour: a chapter's tone, or ink for a section of rules. */
  tone: ChapterTone | 'ink'
  rows: ContentsRow[]
  total?: number
  /** The chapter opener's artwork, under the band. Decorative: the heading names the chapter. */
  art?: ContentsArt
}

/**
 * One section of the index: its colour band and, given one, its artwork; its
 * name and count; its rows.
 */
export function ContentsChapter({ id, title, tone, rows, total, art }: ContentsChapterProps) {
  const headingId = `${id}-heading`
  return (
    <section id={id} className="srd-contents__chapter" aria-labelledby={headingId}>
      <div
        aria-hidden="true"
        className="srd-contents__band"
        style={{ backgroundColor: tone === 'ink' ? 'var(--color-ink)' : CHAPTER_BAND_COLOR[tone] }}
      />
      {art && (
        <div className="srd-contents__art">
          <img
            src={art.src}
            srcSet={art.srcSet}
            sizes={art.srcSet ? ART_SIZES : undefined}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
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

type HomeStartHereProps = {
  /** Each step's creation guide in the book, by step. */
  guideHrefs: ComponentProps<typeof StartHere>['hrefs']
  /** Where "Build a pilot" hands off: ITUN. */
  buildHref: string
  /** "Play now": ITUN's Starter Set (`STARTER_SET_HREF`). */
  starterSetHref: string
}

/**
 * The path in for a new player: the shared "Start here" block both tools show
 * (`StartHere`), each step opening its guide in the book; then the hand-off to
 * ITUN, which turns those pages into a live sheet, and "Play now", the
 * shortcut past all three to the Starter Set's ready-made crew. Both are
 * same-tab links: the two tools are one site (ruleset §3.11).
 */
export function HomeStartHere({ guideHrefs, buildHref, starterSetHref }: HomeStartHereProps) {
  return (
    <StartHere id="start-here" hrefs={guideHrefs}>
      <div className="srd-start-here__foot">
        <p>Ready to build? {PRODUCT.name} turns these pages into a live sheet for your crew.</p>
        <div className="srd-start-here__actions">
          <a href={buildHref} className={buttonVariants({ variant: 'primary', size: 'full' })}>
            Build a pilot
          </a>
          <a href={starterSetHref} className="srd-panel__link">
            Play now with the Starter Set
          </a>
        </div>
      </div>
    </StartHere>
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
