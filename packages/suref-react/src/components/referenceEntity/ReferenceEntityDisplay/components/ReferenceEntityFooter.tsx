import type { ReactNode } from 'react'
import { cn } from '../../../../utils/cn'
import { Text } from '../../../base/Text'
import { accentSurface } from '../../referenceEntityHelpers'
import type { CardFootMeta } from '../../../shared/DisplayCard'

type ReferenceEntityFooterProps = {
  footerDisplayName: string | undefined
  source: string | undefined
  booklet: string | undefined
  page: string | number | undefined
  headerBg: string | undefined
  headerBgColor: string | undefined
  /** Action buttons folded into the foot band (design-spec §2.1 `.ec__acts`) */
  footActions?: ReactNode
  /** Inline label/value meta (`.ec__metafoot`), e.g. AP COST · 1 */
  footMeta?: CardFootMeta[]
}

// Shared type scale for the three footer tags (name / source / page) — one source
// of truth for the footer's size/weight/transform so they can't drift.
const footerTagClass = 'whitespace-nowrap text-[0.6rem] font-medium uppercase'

export function ReferenceEntityFooter({
  footerDisplayName,
  source,
  booklet,
  page,
  headerBg,
  headerBgColor,
  footActions,
  footMeta,
}: ReferenceEntityFooterProps) {
  // Drop the "Salvage Union " prefix in footers — "Salvage Union Workshop
  // Manual" reads as "Workshop Manual", "Salvage Union Starter Set" as
  // "Starter Set" — keeping the source tag short.
  const shortSource = source?.replace(/^Salvage Union\s+/i, '')
  const sourceLabel = shortSource && booklet ? `${shortSource} (${booklet})` : shortSource
  const accent = accentSurface(headerBg, headerBgColor)
  return (
    <div
      className={cn(
        // Slim footer: half the vertical padding, text vertically centred.
        'flex w-full items-center justify-between gap-4 py-1.5 text-su-black',
        accent.className
      )}
      style={{
        // Align the footer's left/right extremes with the white body block
        // edges (the body box is inset by mx-3 = 0.75rem).
        paddingLeft: '0.75rem',
        paddingRight: '0.75rem',
        ...accent.style,
      }}
    >
      <div className="flex min-w-0 shrink items-center gap-2">
        {footerDisplayName && (
          <Text
            variant="pseudoheader"
            as="span"
            className={cn('shrink-0 overflow-hidden text-ellipsis', footerTagClass)}
          >
            {footerDisplayName}
          </Text>
        )}
      </div>

      {/* Foot extras (design .ec__metafoot + .ec__acts): inline meta + action
          buttons folded into the same band, before the source/page tags. */}
      {(footActions || (footMeta && footMeta.length > 0)) && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {footMeta?.map(({ label, value }, i) => (
            <span key={`${label}-${i}`} className="mr-1 inline-flex items-baseline gap-1">
              <span className="font-cond text-[10.5px] font-bold uppercase leading-none opacity-75">
                {label}
              </span>
              <span className="font-body text-[13px] font-bold leading-none">{value}</span>
            </span>
          ))}
          {footActions}
        </div>
      )}

      <div className="flex shrink-0">
        {sourceLabel && (
          <Text variant="pseudoheader" as="span" className={cn(footerTagClass, page && 'mr-4')}>
            {sourceLabel}
          </Text>
        )}
        {page && (
          <Text variant="pseudoheader" as="span" className={footerTagClass}>
            Page {page}
          </Text>
        )}
      </div>
    </div>
  )
}
