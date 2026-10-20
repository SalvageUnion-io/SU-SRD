import { Fragment } from 'react'
import type { StaticEntitySummary } from 'salvageunion-reference'
import { bookName, citeLine } from 'salvageunion-reference'
import { capsLabel } from '../components/atoms/capsLabel'
import { InlineRef, mentionRef, RollTableInstrument, SlabSection, Stat } from '../components/index'
import { MentionProse } from '../components/MentionProse'
import { cn } from '../lib/cn'
import { refText } from '../lib/rollTablePage'

/** A fact's label ("Traits:"), in the caps recipe. */
const STATIC_LABEL = cn('su-static__label', capsLabel({ tracking: 'snug' }))

/**
 * StaticEntityContent — the SSR / no-JS entity fallback. Renders a
 * crawler-friendly summary of an entity (name, description, stats, content,
 * traits, cite) through the blocks every other context draws (hard rule R18):
 * each stat a `Stat` (`STRUCTURE POINTS | 14`), a roll table the
 * `RollTableInstrument` with its plain ROLL THE DIE: stamp, the cite the foot's
 * one line of text (`Workshop Manual · p.65 // … (CR) · p.37`). On the static site the island supplies the real display:
 * every reader sees this `data-static-fallback` block until the card can draw,
 * and `ReferenceEntityIsland` removes it in the same commit that puts the card
 * on screen, so the two never double up and nothing blank or skeletal stands
 * between them.
 *
 * Every trait or keyword it names, in its prose or its trait list, is a
 * Mention resolved at build time (`mentionRef`): a link to its page
 * with its Peek. The summary keeps its prose's `[[Trait]]` markup
 * (`keepReferences`) for exactly that; a summary without it reads as words.
 * The parent link is an `InlineRef`. Layout is `pages.css`'s `.su-static*`.
 */

/** Prose with its references drawn as Mentions. */
function Prose({ text }: { text: string }) {
  return <MentionProse parts={refText(text, mentionRef)} />
}

type StaticEntityContentProps = {
  summary: StaticEntitySummary
  /** What the entity is built on, linked first: a pattern's base chassis. */
  parent?: { label: string; name: string; href: string }
  /**
   * The foot's cite: every printing on one line (`citeLine`). Absent, the
   * summary's own book and page.
   */
  cite?: string | undefined
}

export function StaticEntityContent({ summary, parent, cite: given }: StaticEntityContentProps) {
  // The foot's cite, as every card and Page prints it.
  const cite =
    given ??
    citeLine(summary.source ? [{ book: bookName(summary.source), page: summary.page }] : [])
  return (
    <div data-static-fallback className="su-static">
      {/* No heading of its own: the page's chapter band is its <h1>, for
          crawlers, no-JS readers and the hydrated page alike. */}
      {parent && (
        <p>
          <span className={STATIC_LABEL}>{parent.label}</span>{' '}
          <InlineRef href={parent.href}>{parent.name}</InlineRef>
        </p>
      )}

      {summary.description && (
        <p>
          <Prose text={summary.description} />
        </p>
      )}

      {summary.stats.length > 0 && (
        <div className="su-static__stats">
          {summary.stats.map(({ label, value }) => (
            <Stat key={label} label={label} value={value} />
          ))}
        </div>
      )}

      {summary.contentParagraphs.map((p) => (
        <p key={p}>
          <Prose text={p} />
        </p>
      ))}

      {/*
        A roll table's rows, as the roll instrument draws them everywhere (E14),
        open, with the plain ROLL THE DIE: stamp (no roll in static HTML). Drawn
        in the static HTML, so a crawler, reader mode, or an LLM following
        `llms.txt` sees the outcomes without JavaScript.
      */}
      {summary.table.length > 0 && (
        <RollTableInstrument
          name={`${summary.name} roll table`}
          size="full"
          table={{
            kind: 'bands',
            rows: summary.table.map((row) => ({
              key: row.key,
              label: row.label ?? null,
              value: <Prose text={row.value} />,
            })),
          }}
        />
      )}

      {/* Named sections (a guide's steps; a pattern's base chassis) — most of a
          guide's text lives here, so without it a guide's no-JS/crawler
          rendering is a title and one paragraph. Headings are h2: they sit
          under the h1 above. */}
      {summary.sections.map((section) => (
        <SlabSection
          as="h2"
          title={section.name}
          key={section.name}
          page
          bodyClassName="su-static__section"
        >
          {section.paragraphs.map((p) => (
            <p key={p}>
              <Prose text={p} />
            </p>
          ))}
        </SlabSection>
      ))}

      {summary.traits.length > 0 && (
        <p>
          <span className={STATIC_LABEL}>Traits:</span>{' '}
          {summary.traits.map((t, i) => (
            <Fragment key={t}>
              {i > 0 && ', '}
              <MentionProse parts={[{ text: t, ref: mentionRef(t) ?? null }]} />
            </Fragment>
          ))}
        </p>
      )}

      {cite && <p className="su-static__source">{cite}</p>}
    </div>
  )
}
