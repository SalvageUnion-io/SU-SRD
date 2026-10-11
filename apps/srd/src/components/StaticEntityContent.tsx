import { InlineRef, Slab } from 'component-lib'
import { Fragment } from 'react'
import type { StaticEntitySummary } from 'salvageunion-reference'

/**
 * StaticEntityContent — the SSR / no-JS entity fallback. Renders a plain,
 * crawler-friendly summary of an entity (name, description, stats, content,
 * traits, source). On the static site the hydrated island supplies the real
 * display: `global.css`'s `@media (scripting: enabled)` rule hides this
 * `data-static-fallback` block for JS users before first paint, and
 * `ReferenceEntityIsland` hides it on mount and removes it once game data is
 * ready, so the two never double up.
 *
 * Route-agnostic: trait/keyword links are resolved by the injected
 * `resolveTraitHref` (srd passes its build-time resolver); without it,
 * traits render as plain text. Every link to another entity is an `InlineRef`,
 * the one in-prose reference the design system has. Layout is
 * `pages.css`'s `.srd-static*`.
 */

type StaticEntityContentProps = {
  summary: StaticEntitySummary
  /** Resolve a trait/keyword name to an href, or null for no link. */
  resolveTraitHref?: (traitName: string) => string | null
  /** What the entity is built on, linked first: a pattern's base chassis. */
  parent?: { label: string; name: string; href: string }
}

export function StaticEntityContent({
  summary,
  resolveTraitHref,
  parent,
}: StaticEntityContentProps) {
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

      {summary.description && <p>{summary.description}</p>}

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
        <p key={p}>{p}</p>
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
                    {row.value}
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
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}

      {summary.traits.length > 0 && (
        <p>
          <span className="srd-static__label">Traits:</span>{' '}
          {summary.traits.map((t, i) => {
            const href = resolveTraitHref?.(t) ?? null
            return (
              <Fragment key={t}>
                {i > 0 && ', '}
                {href ? <InlineRef href={href}>{t}</InlineRef> : t}
              </Fragment>
            )
          })}
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
