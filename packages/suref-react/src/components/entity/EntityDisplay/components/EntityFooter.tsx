import { cn } from '../../../../utils/cn'
import { Text } from '../../../base/Text'

type EntityFooterProps = {
  footerDisplayName: string | undefined
  source: string | undefined
  page: string | number | undefined
  compact: boolean
  headerBg: string | undefined
  headerBgColor: string | undefined
  contentPaddingX: number
  sourceFooterStyles: { className: string; style: React.CSSProperties }
}

export function EntityFooter({
  footerDisplayName,
  source,
  page,
  compact,
  headerBg,
  headerBgColor,
  contentPaddingX,
  sourceFooterStyles,
}: EntityFooterProps) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-4 py-3 text-su-black',
        headerBg || 'bg-su-white',
        sourceFooterStyles.className
      )}
      style={{
        paddingLeft: `${contentPaddingX}rem`,
        paddingRight: `${contentPaddingX}rem`,
        ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
        ...sourceFooterStyles.style,
      }}
    >
      <div className="flex min-w-0 shrink items-center gap-2">
        {footerDisplayName && (
          <Text
            variant="pseudoheader"
            as="span"
            className={cn(
              'shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs uppercase',
              compact ? 'font-semibold' : 'font-bold'
            )}
          >
            {footerDisplayName}
          </Text>
        )}
      </div>

      <div className="flex shrink-0">
        {source && (
          <Text
            variant="pseudoheader"
            as="span"
            className={cn('whitespace-nowrap text-xs font-semibold uppercase', page && 'mr-4')}
          >
            {source}
          </Text>
        )}
        {page && (
          <Text
            variant="pseudoheader"
            as="span"
            className={cn(
              'whitespace-nowrap text-xs uppercase',
              compact ? 'font-semibold' : 'font-bold'
            )}
          >
            Page {page}
          </Text>
        )}
      </div>
    </div>
  )
}
