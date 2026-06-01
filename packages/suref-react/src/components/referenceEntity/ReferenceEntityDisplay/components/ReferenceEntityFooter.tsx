import { cn } from '../../../../utils/cn'
import { Text } from '../../../base/Text'

type ReferenceEntityFooterProps = {
  footerDisplayName: string | undefined
  source: string | undefined
  booklet: string | undefined
  page: string | number | undefined
  headerBg: string | undefined
  headerBgColor: string | undefined
  sourceFooterStyles: { className: string; style: React.CSSProperties }
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
  sourceFooterStyles,
}: ReferenceEntityFooterProps) {
  // Drop the "Salvage Union " prefix in footers — "Salvage Union Workshop
  // Manual" reads as "Workshop Manual", "Salvage Union Starter Set" as
  // "Starter Set" — keeping the source tag short.
  const shortSource = source?.replace(/^Salvage Union\s+/i, '')
  const sourceLabel = shortSource && booklet ? `${shortSource} (${booklet})` : shortSource
  return (
    <div
      className={cn(
        // Slim footer: half the vertical padding, text vertically centred.
        'flex w-full items-center justify-between gap-4 py-1.5 text-su-black',
        headerBg || 'bg-su-white',
        sourceFooterStyles.className
      )}
      style={{
        // Align the footer's left/right extremes with the white body block
        // edges (the body box is inset by mx-3 = 0.75rem).
        paddingLeft: '0.75rem',
        paddingRight: '0.75rem',
        ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
        ...sourceFooterStyles.style,
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
