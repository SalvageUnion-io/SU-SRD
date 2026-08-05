import { Fragment } from 'react'
import type { StaticEntitySummary } from 'salvageunion-reference'
import { PageHeading } from '../chrome/PageHeading'

/**
 * StaticEntityContent — the SSR / no-JS entity fallback (originally converted
 * from an srd Astro component, which no longer exists). Renders a plain,
 * crawler-friendly summary of an entity (name, description, stats, content,
 * traits, source). On the static site the hydrated island supplies the real
 * display and BaseLayout strips this `data-static-fallback` block for JS users,
 * so the two never double up.
 *
 * Route-agnostic: trait/keyword links are resolved by the injected
 * `resolveTraitHref` (srd passes its build-time resolver); without it,
 * traits render as plain text.
 */

type StaticEntityContentProps = {
  summary: StaticEntitySummary
  /** Resolve a trait/keyword name to an href, or null for no link. */
  resolveTraitHref?: (traitName: string) => string | null
}

export function StaticEntityContent({ summary, resolveTraitHref }: StaticEntityContentProps) {
  return (
    <div data-static-fallback className="mx-auto w-full max-w-6xl px-4 text-sm text-ink">
      {/* SSR / no-JS heading. JS users get this whole block stripped by BaseLayout
          and the hydrated island supplies the real <h1>, so they never double up. */}
      <PageHeading className="mb-3 w-fit">{summary.name}</PageHeading>

      {summary.description && <p className="mb-3 italic">{summary.description}</p>}

      {summary.stats.length > 0 && (
        <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {summary.stats.map(({ label, value }) => (
            <Fragment key={label}>
              <dt className="font-cond font-bold uppercase">{label}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>
      )}

      {summary.contentParagraphs.length > 0 && (
        <div className="mb-3 space-y-2">
          {summary.contentParagraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}

      {/* Named sections (a guide's steps) — most of a guide's text lives here,
          so without it a guide's no-JS/crawler rendering is a title and one
          paragraph. Headings are h2: they sit under the h1 above. */}
      {summary.sections.length > 0 && (
        <div className="mb-3 space-y-3">
          {summary.sections.map((section) => (
            <section key={section.name}>
              <PageHeading variant="section" as="h2" className="mb-1">
                {section.name}
              </PageHeading>
              <div className="space-y-2">
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {summary.traits.length > 0 && (
        <p className="mb-3">
          <span className="font-cond font-bold uppercase">Traits:</span>{' '}
          {summary.traits.map((t, i) => {
            const href = resolveTraitHref?.(t) ?? null
            return (
              <Fragment key={t}>
                {i > 0 && ', '}
                {href ? (
                  <a href={href} className="underline">
                    {t}
                  </a>
                ) : (
                  t
                )}
              </Fragment>
            )
          })}
        </p>
      )}

      {summary.source && (
        <p className="text-xs text-wk-muted">
          Source: {summary.source}
          {summary.page ? `, p. ${summary.page}` : ''}
        </p>
      )}
    </div>
  )
}
