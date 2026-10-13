import { InlineRef, mentionRef, Slab } from 'component-lib'
import { Fragment } from 'react'
import type { StaticEntitySummary } from 'salvageunion-reference'
import { refText } from '../lib/rollTablePage'
import { MentionProse } from './MentionProse'

/**
 * StaticEntityContent — the SSR / no-JS entity fallback. Renders a plain,
 * crawler-friendly summary of an entity (name, description, stats, content,
 * traits, source). On the static site the island supplies the real display:
 * every reader sees this `data-static-fallback` block until the card can draw,
 * and `ReferenceEntityIsland` removes it in the same commit that puts the card
 * on screen, so the two never double up and nothing blank or skeletal stands
 * between them.
 *
 * Every trait or keyword it names, in its prose or its trait list, is a
 * Mention resolved at build time (`mentionRef`): a link to its page
 * with its Peek. The summary keeps its prose's `[[Trait]]` markup
 * (`keepReferences`) for exactly that; a summary without it reads as words.
 * The parent link is an `InlineRef`. Layout is `pages.css`'s `.srd-static*`.
 */

/** Prose with its references drawn as Mentions. */
function Prose({ text }: { text: string }) {
  return <MentionProse parts={refText(text, mentionRef)} />
}

type StaticEntityContentProps = {
  summary: StaticEntitySummary
  /** What the entity is built on, linked first: a pattern's base chassis. */
  parent?: { label: string; name: string; href: string }
}

export function StaticEntityContent({ summary, parent }: StaticEntityContentProps) {
  return (
    <div data-static-fallback className="srd-static">
      {/* No heading of its own: the page's chapter band is its <h1>, for
          crawlers, no-JS readers and the hydrated page alike. */}
      {parent && (
        <p>
          <span className="srd-static__label">{parent.label}</span>{' '}
          <InlineRef href={parent.href}>{parent.name}</InlineRef>
        </p>
      )}

      {summary.description && (
        <p>
          <Prose text={summary.description} />
        </p>
      )}

      {summary.stats.length > 0 && (
        <dl className="srd-static__stats">
          {summary.stats.map(({ label, value }) => (
            <Fragment key={label}>
              <dt className="srd-static__label">{label}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>
      )}

      {summary.contentParagraphs.map((p) => (
        <p key={p}>
          <Prose text={p} />
        </p>
      ))}

      {/*
        A roll table's rows, as a REAL table.

        Drawn in the static HTML, so a crawler, reader mode, or an LLM following
        `llms.txt` sees the outcomes without JavaScript; island props alone would
        draw nothing.

        `<th scope="row">` on the roll, not a `<td>`: the roll IS the row's
        header, which is what lets a screen reader announce "11-19" with each
        outcome instead of reading a wall of anonymous cells. The `<caption>`
        names the table for the same reason — it is skipped visually but it is
        what a rotor listing reads.
      */}
      {summary.table.length > 0 && (
        <div className="srd-static__table-wrap">
          <table className="srd-static__table">
            <caption className="srd-static__caption">{`${summary.name} roll table`}</caption>
            <thead>
              <tr>
                <th scope="col">Roll</th>
                <th scope="col">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {summary.table.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.key}</th>
                  <td>
                    {row.label && <strong>{row.label}: </strong>}
                    <Prose text={row.value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Named sections (a guide's steps; a pattern's base chassis) — most of a
          guide's text lives here, so without it a guide's no-JS/crawler
          rendering is a title and one paragraph. Headings are h2: they sit
          under the h1 above. */}
      {summary.sections.map((section) => (
        <section key={section.name} className="srd-static__section">
          <Slab as="h2" variant="solid" label={section.name} />
          {section.paragraphs.map((p) => (
            <p key={p}>
              <Prose text={p} />
            </p>
          ))}
        </section>
      ))}

      {summary.traits.length > 0 && (
        <p>
          <span className="srd-static__label">Traits:</span>{' '}
          {summary.traits.map((t, i) => (
            <Fragment key={t}>
              {i > 0 && ', '}
              <MentionProse parts={[{ text: t, ref: mentionRef(t) ?? null }]} />
            </Fragment>
          ))}
        </p>
      )}

      {summary.source && (
        <p className="srd-static__source">
          Source: {summary.source}
          {summary.page ? `, p. ${summary.page}` : ''}
        </p>
      )}
    </div>
  )
}
