import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { borderColorFromHeaderBg } from '../entity/entityDisplayHelpers'

type DisplayCardMode = 'full' | 'compact' | 'listing'

type DisplayCardProps = {
  /** Background color class for header and footer (e.g., "bg-su-green") */
  headerBg: string
  /** Optional CSS color for border derivation */
  headerBgColor?: string
  /** Content rendered inside the header bar */
  headerContent: ReactNode
  /** Content rendered inside the footer bar (optional) */
  footerContent?: ReactNode
  /** Main body content */
  children?: ReactNode
  /** Optional pseudoheader label above the card */
  label?: string
  /** Display mode:
   *  - "full" (default): Standard card with header, body, footer
   *  - "compact": Reduced spacing and typography for inline/grid use
   *  - "listing": Minimal header-only clickable row (entity name + key stats)
   *    — body and footer are hidden; header is the entire card
   */
  mode?: DisplayCardMode
  /** onClick handler (primarily used in listing mode for clickable rows) */
  onClick?: () => void
  /** Additional className on the outer wrapper */
  className?: string
}

export function DisplayCard({
  headerBg,
  headerBgColor,
  headerContent,
  footerContent,
  children,
  label,
  mode = 'full',
  onClick,
  className,
}: DisplayCardProps) {
  const isCompact = mode === 'compact'
  const isListing = mode === 'listing'

  const borderColor = borderColorFromHeaderBg(headerBg, headerBgColor)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick()
      }
    },
    [onClick]
  )

  return (
    <div
      className={cn(
        'relative flex shrink-0 flex-col overflow-hidden rounded-md shadow-lg',
        className
      )}
      style={borderColor ? { borderBottom: `3px solid ${borderColor}` } : undefined}
    >
      {label && (
        <Text
          variant="pseudoheader"
          as="span"
          className={cn(
            'absolute z-10 ml-3 uppercase',
            isCompact
              ? '-mt-1.5 max-w-[80%] origin-left scale-x-[0.85] whitespace-nowrap text-xs'
              : '-mt-2 text-sm'
          )}
        >
          {label}
        </Text>
      )}

      {/* Header */}
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        className={cn(
          'flex w-full items-center justify-between gap-2',
          isListing ? 'min-h-[40px] rounded-md px-2 py-1' : 'rounded-t-sm',
          !isListing && (isCompact ? 'min-h-[60px] px-1.5 py-1' : 'min-h-[80px] px-1.5 py-1.5'),
          !isListing && label && (isCompact ? 'pb-1 pt-2' : 'pb-4 pt-4'),
          headerBg,
          onClick && 'cursor-pointer'
        )}
        style={headerBgColor ? { backgroundColor: headerBgColor } : undefined}
        onClick={onClick}
        onKeyDown={onClick ? handleKeyDown : undefined}
      >
        {headerContent}
      </div>

      {/* Body — hidden in listing mode */}
      {!isListing && children && (
        <div className={cn('flex w-full flex-1 flex-col bg-su-white', isCompact ? 'p-2' : 'p-3')}>
          {children}
        </div>
      )}

      {/* Footer — hidden in listing mode */}
      {!isListing && footerContent && (
        <div
          className={cn(
            'flex w-full items-center justify-between rounded-b-sm px-3 py-2',
            headerBg
          )}
          style={headerBgColor ? { backgroundColor: headerBgColor } : undefined}
        >
          {footerContent}
        </div>
      )}
    </div>
  )
}
