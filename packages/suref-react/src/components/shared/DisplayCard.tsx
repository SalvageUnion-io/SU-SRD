import { useCallback } from 'react'
import type { ReactNode } from 'react'
import type { SURefEnumSource } from 'salvageunion-reference'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { ControlButtons } from './ControlButtons'
import { getSourceStyles } from '../entity/entityDisplayHelpers'
import type { EntityControl } from '../entity/EntityDisplay/entityControlTypes'

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
  /** Controls rendered at the card level. In listing mode with a single control,
   * the button is auto-hidden and the entire row becomes clickable.
   * When provided, controls should NOT also be passed to CardHeader. */
  controls?: EntityControl[]
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
  controls,
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

  // Single control on listings → entire header is clickable; hide the redundant button
  const listingOnClick =
    isListing && !onClick && controls?.length === 1 ? controls[0]!.onClick : undefined
  const resolvedOnClick = onClick ?? listingOnClick
  const effectiveControls = listingOnClick
    ? controls!.map((c) => ({ ...c, hidden: true }))
    : controls

  const actualHeaderBg = headerBg
  const headerSourceStyles = getSourceStyles(source, false, 'header', isExpanded)
  const footerSourceStyles = getSourceStyles(source, false, 'footer', isExpanded)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (resolvedOnClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        resolvedOnClick()
      }
    },
    [resolvedOnClick]
  )

  const defaultBodyPadding = isCompact ? 'p-2' : 'p-3'
  const borderWidth = isCompact || isListing ? 2 : 3

  return (
    <div
      className={cn(
        'relative flex shrink-0 flex-col overflow-visible rounded-md shadow-lg',
        isListing && 'h-full',
        disabled && 'opacity-50',
        className
      )}
      style={actualHeaderBg ? { border: `${borderWidth}px solid black` } : undefined}
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
          className="absolute top-0 z-10 ml-3 -translate-y-1/2 whitespace-nowrap text-xs uppercase"
        >
          {label}
        </Text>
      )}

      {/* Inner wrapper clips backgrounds to border-radius */}
      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{ borderRadius: `calc(0.375rem - ${borderWidth}px)` }}
      >
        {/* Header */}
        <div
          role={resolvedOnClick ? 'button' : undefined}
          tabIndex={resolvedOnClick ? 0 : undefined}
          className={cn(
            'flex w-full items-center justify-between gap-2 overflow-visible',
            isListing ? 'min-h-[40px] flex-1 px-2 py-1' : '',
            !isListing && (isCompact ? 'min-h-[60px] px-1.5 py-1' : 'min-h-[80px] px-1.5 py-1.5'),
            !isListing && !isCompact && label && 'pb-4 pt-4',
            !isListing && isCompact && label && 'pt-2',
            actualHeaderBg,
            resolvedOnClick && 'cursor-pointer',
            headerSourceStyles.className
          )}
          style={{
            opacity: headerOpacity,
            ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
            ...headerSourceStyles.style,
          }}
          onClick={resolvedOnClick}
          onKeyDown={resolvedOnClick ? handleKeyDown : undefined}
          data-testid={headerTestId}
        >
          {effectiveControls ? (
            <>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 overflow-visible">
                {headerContent}
              </div>
              <ControlButtons controls={effectiveControls} size="sm" />
            </>
          ) : (
            headerContent
          )}
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
              'flex w-full items-center justify-between px-3 py-2',
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
    </div>
  )
}
