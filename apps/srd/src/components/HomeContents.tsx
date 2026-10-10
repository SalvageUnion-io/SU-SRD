import type { ChapterTone } from 'component-lib'
import { buttonVariants, CHAPTER_BAND_COLOR } from 'component-lib'
import type { ChapterRow } from '../lib/chapters'

/**
 * The home page as the manual's Contents page (board 06): the book's chapters
 * as an index, each headed by a band in its colour with its real entry count,
 * and beside them the "New to the Union?" path and the rules a table reaches
 * for. Server-rendered and static: every row is a plain link.
 *
 * Rows are 36px for a fine pointer and 44px under `(pointer: coarse)` (the
 * repo's touch floor, ruleset §4.6) — `global.css`'s `.srd-contents__row`.
 */

type ContentsChapterProps = {
  id: string
  title: string
  tone: ChapterTone
  rows: ChapterRow[]
  total: number
}

/** One chapter of the index: its colour band, its name and count, its rows. */
export function ContentsChapter({ id, title, tone, rows, total }: ContentsChapterProps) {
  const headingId = `${id}-heading`
  return (
    <section id={id} className="srd-contents__chapter" aria-labelledby={headingId}>
      <div
        aria-hidden="true"
        className="srd-contents__band"
        style={{ backgroundColor: CHAPTER_BAND_COLOR[tone] }}
      />
      <h2 id={headingId} className="srd-contents__heading">
        <span>{title}</span>
        <span className="srd-contents__total">{total}</span>
      </h2>
      <ul className="srd-contents__rows">
        {rows.map((row) => (
          <li key={row.schemaId}>
            <a href={row.href} className="srd-contents__row">
              <span>{row.label}</span>
              <span className="srd-contents__count">{row.count}</span>
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

export type AtTheTableLink = { label: string; href: string }

/** The rules a table reaches for mid-session, one click from Contents. */
export function AtTheTable({ links }: { links: AtTheTableLink[] }) {
  return (
    <section className="srd-panel" aria-labelledby="at-the-table">
      <h2 id="at-the-table" className="srd-panel__heading srd-panel__heading--small">
        At the table
      </h2>
      <ul className="srd-contents__rows srd-panel__rows">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} className="srd-contents__row">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
