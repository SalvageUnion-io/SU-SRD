import { useState, useCallback, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { SURefEnumSource } from 'salvageunion-reference'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { CardImage } from './CardImage'
import { ControlButtons } from './ControlButtons'
import {
  getSourceStyles,
  getSourceBorderColor,
  borderColorFromHeaderBg,
} from '../referenceEntity/referenceEntityHelpers'
import type { ReferenceEntityControl } from '../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'
import { StickyHeaderContext } from './StickyHeaderContext'

type DisplayCardMode = 'full' | 'compact' | 'listing'

export type DisplayCardTab = {
  key: string
  label: string
  content: ReactNode
  /** CSS color override for the active-tab background (defaults to header-derived tint) */
  activeColor?: string
}

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
  /** Make header sticky when scrolling. Section separators inside the card auto-stick below. */
  stickyHeader?: boolean
  /** Additional tabs beyond the default content. Ignored in listing mode. */
  tabs?: DisplayCardTab[]
  /** Label for the default (children) tab. Defaults to "Info". */
  defaultTabLabel?: string
}

const DEFAULT_TAB_KEY = '__default'

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
  stickyHeader = false,
  tabs,
  defaultTabLabel = 'Info',
}: DisplayCardProps) {
  const isCompact = mode === 'compact'
  const isListing = mode === 'listing'
  const hasTabs = !isListing && tabs && tabs.length > 0

  const [activeTabKey, setActiveTabKey] = useState(DEFAULT_TAB_KEY)

  // Resolve card-level click: onCardClick prop → fallback to controls with cardClick
  const cardClickControls = !onCardClick && controls ? controls.filter((c) => c.cardClick) : []
  if (cardClickControls.length > 1) {
    console.warn(
      'DisplayCard: multiple controls set cardClick — last one wins',
      cardClickControls.map((c) => c.key)
    )
  }
  const resolvedCardClick =
    onCardClick ??
    (cardClickControls.length > 0
      ? cardClickControls[cardClickControls.length - 1]!.onClick
      : undefined)

  // Hover effect when card is clickable (via handler or boolean flag)
  const isCardHoverable = !!resolvedCardClick || cardClickable

  const actualHeaderBg = headerBg
  const headerSourceStyles = getSourceStyles(source, false, 'header', isExpanded)
  const footerSourceStyles = getSourceStyles(source, false, 'footer', isExpanded)
  const cardSourceStyles = getSourceStyles(source, false, 'card', isExpanded)

  // Expansion border color falls back when no explicit prop override
  const effectiveBorderColor =
    borderColorProp !== 'black' ? borderColorProp : (getSourceBorderColor(source) ?? 'black')

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

  // Sticky header: measure header height and set CSS variable for SectionSeparator offsets
  const wrapperRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!stickyHeader || !headerRef.current || !wrapperRef.current) return
    const header = headerRef.current
    const wrapper = wrapperRef.current
    const update = () => {
      const navH = parseFloat(getComputedStyle(wrapper).getPropertyValue('--app-nav-h')) || 0
      wrapper.style.setProperty('--sticky-header-h', `${navH + header.offsetHeight}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(header)
    return () => ro.disconnect()
  }, [stickyHeader])

  const defaultBodyPadding = isCompact ? 'p-2' : 'p-3'
  const borderWidth = isCompact || isListing ? 2 : 3

  const isDefaultTab = activeTabKey === DEFAULT_TAB_KEY
  const activeTab = hasTabs ? tabs.find((t) => t.key === activeTabKey) : undefined
  const showBody = !isListing && (isDefaultTab ? !!(children || image) : !!activeTab)

  // Pale version of header color for active tab background
  const activeTabBg = hasTabs
    ? (() => {
        const cssColor = borderColorFromHeaderBg(headerBg, headerBgColor)
        return cssColor ? `color-mix(in srgb, ${cssColor} 35%, white)` : undefined
      })()
    : undefined

  return (
    <div
      ref={wrapperRef}
      role={resolvedCardClick ? 'button' : undefined}
      tabIndex={resolvedCardClick ? 0 : undefined}
      className={cn(
        'relative flex shrink-0 flex-col overflow-visible rounded-md',
        cardSourceStyles.className || 'shadow-lg',
        disabled && 'opacity-50',
        isCardHoverable &&
          'cursor-pointer transition-all duration-200 md:hover:z-10 md:hover:-translate-y-0.5 md:hover:scale-[1.02]',
        className
      )}
      style={{
        ...(actualHeaderBg ? { border: `${borderWidth}px solid ${effectiveBorderColor}` } : {}),
        ...cardSourceStyles.style,
      }}
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

      {/* Inner wrapper clips backgrounds to border-radius.
          overflow-clip (instead of hidden) when stickyHeader so position:sticky works. */}
      <div
        className={cn(
          'flex flex-1',
          stickyHeader ? 'overflow-clip' : 'overflow-hidden',
          !isListing && 'flex-col'
        )}
        style={{ borderRadius: `calc(0.375rem - ${borderWidth}px)` }}
      >
        {/* Header wrapper — contains content row + optional tab bar.
            When stickyHeader, both stick together. headerRef measures the full height. */}
        <div
          ref={stickyHeader ? headerRef : undefined}
          className={cn('w-full', hasTabs && 'flex flex-col', stickyHeader && 'sticky z-20')}
          style={{
            ...(stickyHeader ? { top: 'var(--app-nav-h, 0px)' } : {}),
          }}
        >
          {/* Content row — existing header layout */}
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
              headerSourceStyles.className,
              headerSourceStyles.className && 'h-full'
            )}
            style={{
              opacity: headerOpacity,
              ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
              ...headerSourceStyles.style,
              ...(!isListing && (children || image || footerContent || hasTabs)
                ? { borderBottom: `${borderWidth}px solid ${effectiveBorderColor}` }
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

          {/* Tab bar — only when hasTabs */}
          {hasTabs && (
            <div className="flex" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={isDefaultTab}
                className={cn(
                  'flex-1 cursor-pointer py-1.5 font-mono text-xs font-bold uppercase tracking-wide transition-colors',
                  isDefaultTab
                    ? 'text-su-black'
                    : 'bg-su-white text-su-black hover:bg-su-grey-light'
                )}
                style={isDefaultTab && activeTabBg ? { backgroundColor: activeTabBg } : undefined}
                onClick={() => setActiveTabKey(DEFAULT_TAB_KEY)}
              >
                {defaultTabLabel}
              </button>
              {tabs.map((tab) => {
                const isActive = activeTabKey === tab.key
                const tabBg = tab.activeColor
                  ? `color-mix(in srgb, ${tab.activeColor} 35%, white)`
                  : activeTabBg
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={cn(
                      'flex-1 cursor-pointer py-1.5 font-mono text-xs font-bold uppercase tracking-wide transition-colors',
                      isActive
                        ? 'text-su-black'
                        : 'bg-su-white text-su-black hover:bg-su-grey-light'
                    )}
                    style={isActive && tabBg ? { backgroundColor: tabBg } : undefined}
                    onClick={() => setActiveTabKey(tab.key)}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Body — hidden in listing mode */}
        {showBody && (
          <StickyHeaderContext.Provider value={stickyHeader}>
            <div
              className={cn(
                'w-full flex-1 bg-su-white',
                isDefaultTab && image ? '' : 'flex flex-col',
                bodyPadding || defaultBodyPadding
              )}
            >
              {isDefaultTab ? (
                <>
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
                </>
              ) : (
                activeTab?.content
              )}
            </div>
          </StickyHeaderContext.Provider>
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
              borderTop: `${borderWidth}px solid ${effectiveBorderColor}`,
            }}
          >
            {footerContent}
          </div>
        )}
      </div>
    </div>
  )
}
