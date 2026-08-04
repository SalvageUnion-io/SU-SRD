import type { ReactNode } from 'react'

import { cn } from '../../../utils/cn'
import type { CardFootMeta } from '../../shared/Card'
import { type AdditionalSource, formatProvenance } from './provenance'

type EntityCardIdentityFooterProps = {
  /** Darker shade of the domain/tech-level tone (a raw CSS colour). */
  bgColor: string
  /** Entity TYPE (e.g. "Chassis") — plain muted text on the LEFT of the row. */
  typeLabel: string | undefined
  source: string | undefined
  booklet: string | undefined
  page: number | undefined
  /**
   * REPRINTS — the other books this entity also appears in (`additionalSources`
   * in the dataset). A SECOND line under the primary source, labelled so it
   * reads as an additional printing rather than a competing provenance. Absent
   * or empty ⇒ no line at all (most records have none). The card gates this to
   * the roomy footer; see the call site.
   */
  additionalSources?: AdditionalSource[]
  /** Write-layer: inline `[label value]` meta pairs (cost / SV) folded into the
   * footer's right side, before the source/page. */
  footMeta?: CardFootMeta[]
  /**
   * App-supplied cross-link (ITUN's "View in SRD →"), sourced from
   * `EntityExternalLinkProvider`. Full extent only — the card passes
   * `undefined` for head/catalog so listings stay uncluttered.
   */
  externalLink?: ReactNode
  compact?: boolean
}

/**
 * EntityCardIdentityFooter — the card's FOOTER band (depth-0 / full cards only).
 *
 * ONE muted row: the entity TYPE on the LEFT, provenance (source · page) on the
 * RIGHT — e.g. "Chassis … Salvage Union Workshop Manual · p.128". The type is
 * PLAIN muted text in the exact footer treatment (not a Stamp/pseudoheader);
 * the type stamp moved OUT of the seam to here on full cards. (Nested/compact
 * cards have no footer, so they keep the type stamp in the seam.)
 *
 * A SECOND, right-aligned line follows when the entity carries reprints
 * (`additionalSources`) — "Also in  Salvage Union Starter Set (PH) · p.38". It
 * is the same muted treatment as the primary line with an `Also in` label in the
 * footer's existing label vocabulary, because it is the SAME kind of fact (which
 * book, which page), just a secondary printing. With no reprints the band is
 * byte-for-byte what it was: one row, same padding.
 */
export function EntityCardIdentityFooter({
  bgColor,
  typeLabel,
  source,
  booklet,
  page,
  additionalSources,
  footMeta,
  externalLink,
  compact = false,
}: EntityCardIdentityFooterProps) {
  const primary = formatProvenance(source, booklet, page)
  const reprints = (additionalSources ?? [])
    .map((entry) => formatProvenance(entry.source, entry.booklet, entry.page))
    .filter((line): line is string => !!line)
  // Foot extras force the band even without source/page data — they are
  // affordances, not source chrome.
  const hasFootExtras = (footMeta?.length ?? 0) > 0 || !!externalLink

  if (!typeLabel && !primary && reprints.length === 0 && !hasFootExtras) return null

  const textClass = 'truncate font-body text-xs font-normal normal-case text-paper/70'

  return (
    <div
      className={cn(
        // px-3 so the type's left edge lines up with the seam/title/sub-header.
        'flex w-full flex-col gap-1',
        // The band was 4px/6px of padding around a 12px line — a 24px strip
        // that read as a hairline rather than a footer, especially on the live
        // sheets (every card there is `medium`, so it took the compact rung).
        compact ? 'px-3 py-2' : 'px-3 py-2.5'
      )}
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span className={textClass}>{typeLabel ?? ''}</span>
        {/* Foot extras — inline meta pairs (cost / SV) folded into the band, then
          the source/page on the far right. */}
        <div className="flex min-w-0 items-center justify-end gap-2">
          {footMeta?.map(({ label, value }, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static per-render list; index disambiguates repeated labels
            <span key={`${label}-${i}`} className="inline-flex shrink-0 items-baseline gap-1">
              <span className="font-cond text-xs font-bold uppercase leading-none text-paper/70">
                {label}
              </span>
              <span className="font-body text-xs font-bold leading-none text-paper">{value}</span>
            </span>
          ))}
          {primary && <span className={textClass}>{primary}</span>}
          {externalLink && <span className={cn(textClass, 'shrink-0')}>{externalLink}</span>}
        </div>
      </div>
      {/* REPRINTS — the additional-printings line. Right-aligned under the
          primary source it extends; wraps rather than truncating, since a second
          printing is a whole book title and a clipped one names nothing. */}
      {reprints.length > 0 && (
        <div className="flex w-full flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5">
          <span className="font-cond text-xs font-bold uppercase leading-none text-paper/70">
            Also in
          </span>
          <span className="font-body text-xs font-normal normal-case text-paper/70">
            {reprints.join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}
