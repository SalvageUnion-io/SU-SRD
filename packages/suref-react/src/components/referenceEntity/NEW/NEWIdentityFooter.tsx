import { cn } from '../../../utils/cn'

export type NEWCardDomain = 'pilot' | 'mech' | 'crawler' | 'monster' | 'gear' | 'action'

type NEWIdentityFooterProps = {
  /** Darker shade of the domain/tech-level tone (a raw CSS colour). */
  bgColor: string
  /** Entity TYPE (e.g. "Chassis") — plain muted text on the LEFT of the row. */
  typeLabel: string | undefined
  source: string | undefined
  booklet: string | undefined
  page: number | undefined
  compact?: boolean
}

/**
 * NEWIdentityFooter — the card's FOOTER band (depth-0 / full cards only).
 *
 * ONE muted row: the entity TYPE on the LEFT, provenance (source · page) on the
 * RIGHT — e.g. "Chassis … Salvage Union Workshop Manual · p.128". The type is
 * PLAIN muted text in the exact footer treatment (not a Stamp/pseudoheader);
 * the type stamp moved OUT of the seam to here on full cards. (Nested/compact
 * cards have no footer, so they keep the type stamp in the seam.)
 */
export function NEWIdentityFooter({
  bgColor,
  typeLabel,
  source,
  booklet,
  page,
  compact = false,
}: NEWIdentityFooterProps) {
  const sourceLabel = source && booklet ? `${source} (${booklet})` : source
  const rightParts = [sourceLabel, page !== undefined ? `p.${page}` : undefined].filter(
    (part): part is string => !!part
  )

  if (!typeLabel && rightParts.length === 0) return null

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
      {rightParts.length > 0 && <span className={textClass}>{rightParts.join(' · ')}</span>}
    </div>
  )
}
