import { useCallback } from 'react'
import type { ReactNode } from 'react'
import type { SURefEnumSource } from 'salvageunion-reference'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { CardImage } from './CardImage'
import { ControlButtons } from './ControlButtons'
import { getSourceStyles } from '../referenceEntity/referenceEntityHelpers'
import type { ReferenceEntityControl } from '../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'

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
  /** onClick handler applied to the header (for direct header-click use cases) */
  onClick?: () => void
  /** Click handler for the entire card. Adds hover enlarge effect + cursor-pointer.
   * Controls with `cardClick: true` also contribute (fallback when this is not set). */
  onCardClick?: () => void
  /** Enable hover enlarge effect without a click handler (e.g., when wrapped in an <a>) */
  cardClickable?: boolean
  /** Controls rendered at the card level. Controls with `cardClick: true` make
   * the entire card clickable with a hover enlarge effect (any mode).
   * Controls with `hidden: true` are not rendered as buttons.
   * When provided, controls should NOT also be passed to CardHeader. */
  controls?: ReferenceEntityControl[]
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
  /** CSS color for card borders (external + internal). Defaults to 'black'. */
  borderColor?: string
  /** Image rendered at the top of the body (floated left). Hidden in listing mode. */
  image?: {
    url?: string
    alt?: string
    editable?: {
      customUrl?: string | null
      onSetCustom: (url: string | null) => void
    }
  }
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
  onCardClick,
  cardClickable = false,
  controls,
  className,
  disabled = false,
  bodyPadding,
  source,
  isExpanded = true,
  borderColor: borderColorProp = 'black',
  headerTestId,
  absoluteElements,
  image,
}: DisplayCardProps) {
  const isCompact = mode === 'compact'
  const isListing = mode === 'listing'

  // Resolve card-level click: onCardClick prop → fallback to controls with cardClick
  const cardClickControls = !onCardClick && controls
    ? controls.filter((c) => c.cardClick)
    : []
  if (cardClickControls.length > 1) {
    console.warn(
      'DisplayCard: multiple controls set cardClick — last one wins',
      cardClickControls.map((c) => c.key)
    )
  }
  const resolvedCardClick = onCardClick ?? (
    cardClickControls.length > 0
      ? cardClickControls[cardClickControls.length - 1]!.onClick
      : undefined
  )

  // Hover effect when card is clickable (via handler or boolean flag)
  const isCardHoverable = !!resolvedCardClick || cardClickable

  const actualHeaderBg = headerBg
  const headerSourceStyles = getSourceStyles(source, false, 'header', isExpanded)
  const footerSourceStyles = getSourceStyles(source, false, 'footer', isExpanded)

  const handleHeaderKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick()
      }
    },
    [onClick]
  )

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (resolvedCardClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        resolvedCardClick()
      }
    },
    [resolvedCardClick]
  )

  const defaultBodyPadding = isCompact ? 'p-2' : 'p-3'
  const borderWidth = isCompact || isListing ? 2 : 3

  return (
    <div
      role={resolvedCardClick ? 'button' : undefined}
      tabIndex={resolvedCardClick ? 0 : undefined}
      className={cn(
        'relative flex shrink-0 flex-col overflow-visible rounded-md shadow-lg',
        disabled && 'opacity-50',
        isCardHoverable &&
          'cursor-pointer transition-all duration-200 md:hover:z-10 md:hover:-translate-y-0.5 md:hover:scale-[1.02]',
        className
      )}
      style={actualHeaderBg ? { border: `${borderWidth}px solid ${borderColorProp}` } : undefined}
      onClick={resolvedCardClick}
      onKeyDown={resolvedCardClick ? handleCardKeyDown : undefined}
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
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          className={cn(
            'flex w-full items-center justify-between gap-2 overflow-visible',
            isListing ? 'min-h-[40px] px-2 py-1' : '',
            !isListing && (isCompact ? 'min-h-[60px] px-1.5 py-1' : 'min-h-[80px] px-1.5 py-1.5'),
            !isListing && !isCompact && label && 'pb-4 pt-4',
            !isListing && isCompact && label && 'pt-2',
            actualHeaderBg,
            onClick && 'cursor-pointer',
            headerSourceStyles.className
          )}
          style={{
            opacity: headerOpacity,
            ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
            ...headerSourceStyles.style,
            ...(!isListing && (children || image || footerContent)
              ? { borderBottom: `${borderWidth}px solid ${borderColorProp}` }
              : {}),
          }}
          onClick={onClick}
          onKeyDown={onClick ? handleHeaderKeyDown : undefined}
          data-testid={headerTestId}
        >
          {controls ? (
            <>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 overflow-visible">
                {headerContent}
              </div>
              <ControlButtons controls={controls} size="sm" />
            </>
          ) : (
            headerContent
          )}
        </div>

        {/* Body — hidden in listing mode */}
        {!isListing && (children || image) && (
          <div
            className={cn(
              'w-full flex-1 bg-su-white',
              image ? '' : 'flex flex-col',
              bodyPadding || defaultBodyPadding
            )}
          >
            {image && (
              <CardImage
                url={image.url}
                alt={image.alt}
                compact={isCompact}
                editable={image.editable}
              />
            )}
            {children}
            {image && <div className="clear-both" />}
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
              borderTop: `${borderWidth}px solid black`,
            }}
          >
            {footerContent}
          </div>
        )}
      </div>
    </div>
  )
}
