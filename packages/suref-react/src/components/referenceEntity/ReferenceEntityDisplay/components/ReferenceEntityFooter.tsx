import { cn } from '../../../../utils/cn'
import { Text } from '../../../base/Text'

type ReferenceEntityFooterProps = {
  footerDisplayName: string | undefined
  source: string | undefined
  booklet: string | undefined
  page: string | number | undefined
  compact: boolean
  headerBg: string | undefined
  headerBgColor: string | undefined
  contentPaddingX: number
  sourceFooterStyles: { className: string; style: React.CSSProperties }
}

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
            className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.6rem] font-medium uppercase"
          >
            {footerDisplayName}
          </Text>
        )}
      </div>

      <div className="flex shrink-0">
        {sourceLabel && (
          <Text
            variant="pseudoheader"
            as="span"
            className={cn('whitespace-nowrap text-[0.6rem] font-medium uppercase', page && 'mr-4')}
          >
            {sourceLabel}
          </Text>
        )}
        {page && (
          <Text
            variant="pseudoheader"
            as="span"
            className="whitespace-nowrap text-[0.6rem] font-medium uppercase"
          >
            Page {page}
          </Text>
        )}
      </div>
    </div>
  )
}
