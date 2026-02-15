import { useCallback } from 'react'
import type { ReactNode } from 'react'
import type { SURefEnumSource } from 'salvageunion-reference'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { borderColorFromHeaderBg, getSourceStyles } from '../entity/entityDisplayHelpers'

type DisplayCardMode = 'full' | 'compact' | 'listing'

type DisplayCardProps = {
  /** Background color class for header and footer (e.g., "bg-su-green") */
  headerBg: string
  /** Optional CSS color for border derivation */
  headerBgColor?: string
  /** Opacity on header div (default: 1) */
  headerOpacity?: number
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
  /** Grey header + reduced opacity for disabled state */
  disabled?: boolean
  /** Override default body padding (e.g., "p-0") */
  bodyPadding?: string
  /** Expansion source for themed styling */
  source?: SURefEnumSource
  /** Whether to apply expansion effects (default: true) */
  isExpanded?: boolean
  /** data-testid on the header div */
  headerTestId?: string
  /** Positioned absolutely inside wrapper div */
  absoluteElements?: ReactNode
}

export function DisplayCard({
  headerBg,
  headerBgColor,
  headerOpacity = 1,
  headerContent,
  footerContent,
  children,
  label,
  mode = 'full',
  onClick,
  className,
  disabled = false,
  bodyPadding,
  source,
  isExpanded = true,
  headerTestId,
  absoluteElements,
}: DisplayCardProps) {
  const isCompact = mode === 'compact'
  const isListing = mode === 'listing'

  const actualHeaderBg = disabled ? 'bg-su-grey' : headerBg
  const borderColor = borderColorFromHeaderBg(actualHeaderBg, headerBgColor)
  const headerSourceStyles = getSourceStyles(source, disabled, 'header', isExpanded)
  const footerSourceStyles = getSourceStyles(source, disabled, 'footer', isExpanded)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick()
      }
    },
    [onClick]
  )

  const defaultBodyPadding = isCompact ? 'p-2' : 'p-3'

  return (
    <div
      className={cn(
        'relative flex shrink-0 flex-col overflow-visible rounded-md shadow-lg',
        className
      )}
      style={borderColor && !isListing ? { borderBottom: `3px solid ${borderColor}` } : undefined}
    >
      {absoluteElements}
      {label && !isCompact && !isListing && (
        <Text
          variant="pseudoheader"
          as="span"
          className="absolute z-10 ml-3 -mt-2 text-sm uppercase"
        >
          {label}
        </Text>
      )}
      {label && (isCompact || isListing) && (
        <Text
          variant="pseudoheader"
          as="span"
          className="ml-3 max-w-[80%] origin-left scale-x-[0.85] whitespace-nowrap text-xs uppercase"
        >
          {label}
        </Text>
      )}

      {/* Header */}
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        className={cn(
          'flex w-full items-center justify-between gap-2 overflow-visible',
          isListing ? 'min-h-[40px] rounded-md px-2 py-1' : 'rounded-t-sm',
          !isListing && (isCompact ? 'min-h-[60px] px-1.5 py-1' : 'min-h-[80px] px-1.5 py-1.5'),
          !isListing && !isCompact && label && 'pb-4 pt-4',
          actualHeaderBg,
          onClick && 'cursor-pointer',
          headerSourceStyles.className
        )}
        style={{
          opacity: headerOpacity,
          ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
          ...headerSourceStyles.style,
        }}
        onClick={onClick}
        onKeyDown={onClick ? handleKeyDown : undefined}
        data-testid={headerTestId}
      >
        {headerContent}
      </div>

      {/* Body — hidden in listing mode */}
      {!isListing && children && (
        <div
          className={cn(
            'flex w-full flex-1 flex-col bg-su-white',
            bodyPadding || defaultBodyPadding
          )}
        >
          {children}
        </div>
      )}

      {/* Footer — hidden in listing mode */}
      {!isListing && footerContent && (
        <div
          className={cn(
            'flex w-full items-center justify-between rounded-b-sm px-3 py-2',
            actualHeaderBg,
            footerSourceStyles.className
          )}
          style={{
            ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
            ...footerSourceStyles.style,
          }}
        >
          {footerContent}
        </div>
      )}
    </div>
  )
}
