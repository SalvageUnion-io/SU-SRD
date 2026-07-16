import { cn } from '../../../utils/cn'

export type NEWCardDomain = 'pilot' | 'mech' | 'crawler' | 'monster' | 'gear' | 'action'

type NEWIdentityFooterProps = {
  /** Darker shade of the domain/tech-level tone (a raw CSS colour). */
  bgColor: string
  source: string | undefined
  booklet: string | undefined
  page: number | undefined
  compact?: boolean
}

/**
 * NEWIdentityFooter — the card's FOOTER band (depth-0 only). Holds ONLY the
 * provenance: source + page, grouped together and pushed to the RIGHT corner
 * (e.g. "Workshop Manual · p.276"). No domain·type callout — that identity
 * reads from the seam stamp + tone, not a footer line.
 */
export function NEWIdentityFooter({
  bgColor,
  source,
  booklet,
  page,
  compact = false,
}: NEWIdentityFooterProps) {
  const sourceLabel = source && booklet ? `${source} (${booklet})` : source
  const parts = [sourceLabel, page !== undefined ? `p.${page}` : undefined].filter(
    (part): part is string => !!part
  )

  if (parts.length === 0) return null

  return (
    <div
      className={cn(
        'flex w-full items-center justify-end',
        compact ? 'px-2.5 py-1' : 'px-3.5 py-1.5'
      )}
      style={{ backgroundColor: bgColor }}
    >
      <span className="truncate font-body text-xs font-normal normal-case text-paper/70">
        {parts.join(' · ')}
      </span>
    </div>
  )
}
