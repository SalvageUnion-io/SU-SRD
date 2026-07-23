import type { ReactNode } from 'react'

import { cn } from '../../../utils/cn'
import type { CardFootMeta } from '../../shared/Card'

export type { CardDomain } from './entityCardTone'

type EntityCardIdentityFooterProps = {
  /** Darker shade of the domain/tech-level tone (a raw CSS colour). */
  bgColor: string
  /** Entity TYPE (e.g. "Chassis") — plain muted text on the LEFT of the row. */
  typeLabel: string | undefined
  source: string | undefined
  booklet: string | undefined
  page: number | undefined
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
 */
export function EntityCardIdentityFooter({
  bgColor,
  typeLabel,
  source,
  booklet,
  page,
  footMeta,
  externalLink,
  compact = false,
}: EntityCardIdentityFooterProps) {
  const sourceLabel = source && booklet ? `${source} (${booklet})` : source
  const rightParts = [sourceLabel, page !== undefined ? `p.${page}` : undefined].filter(
    (part): part is string => !!part
  )
  // Foot extras force the band even without source/page data — they are
  // affordances, not source chrome.
  const hasFootExtras = (footMeta?.length ?? 0) > 0 || !!externalLink

  if (!typeLabel && rightParts.length === 0 && !hasFootExtras) return null

  const textClass = 'truncate font-body text-xs font-normal normal-case text-paper/70'

  return (
    <div
      className={cn(
        // px-3 so the type's left edge lines up with the seam/title/sub-header.
        'flex w-full items-center justify-between gap-3',
        compact ? 'px-3 py-1' : 'px-3 py-1.5'
      )}
      style={{ backgroundColor: bgColor }}
    >
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
        {rightParts.length > 0 && <span className={textClass}>{rightParts.join(' · ')}</span>}
        {externalLink && <span className={cn(textClass, 'shrink-0')}>{externalLink}</span>}
      </div>
    </div>
  )
}
