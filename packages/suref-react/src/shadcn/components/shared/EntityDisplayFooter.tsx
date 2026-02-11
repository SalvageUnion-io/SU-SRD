import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import type { SURefEnumSource } from 'salvageunion-reference'
import { getSourceStyles } from '../entity/entityDisplayHelpers'

type EntityDisplayFooterProps = {
  source?: SURefEnumSource
  page?: number | string
  disabled?: boolean
  isExpanded?: boolean
  className?: string
}

export function EntityDisplayFooter({
  source,
  page,
  disabled = false,
  isExpanded = true,
  className,
}: EntityDisplayFooterProps) {
  if (!source) return null

  const sourceStyles = getSourceStyles(source, disabled, 'footer', isExpanded)

  return (
    <div
      className={cn(
        'flex w-full items-center justify-between overflow-visible px-2 py-1',
        sourceStyles.className,
        className
      )}
      style={sourceStyles.style}
    >
      <Text as="span" className="text-xs italic text-su-grey-dark">
        {source}
      </Text>
      {page !== undefined && (
        <Text as="span" className="text-xs text-su-grey-dark">
          p.{page}
        </Text>
      )}
    </div>
  )
}
