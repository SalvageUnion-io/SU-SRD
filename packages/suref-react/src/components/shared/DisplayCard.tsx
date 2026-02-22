import { useState, useCallback, useRef, useEffect, useLayoutEffect, useContext } from 'react'
import type { ReactNode } from 'react'
import type { SURefEnumSource } from 'salvageunion-reference'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { CardImage } from './CardImage'
import { ControlButtons } from './ControlButtons'
import { StatsBar } from './StatsBar'
import type { StatItem } from './statsBarTypes'
import {
  getSourceStyles,
  getSourceBorderColor,
  borderColorFromHeaderBg,
} from '../referenceEntity/referenceEntityHelpers'
import type { ReferenceEntityControl } from '../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'
import { StickyHeaderContext, StickyOffsetContext } from './StickyHeaderContext'

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
  /** Compact sizing: reduced min-height, padding, border width, font/stat sizes */
  compact?: boolean
  /** Header-only rendering: hides body, footer, and tabs. Orthogonal to compact. */
  listing?: boolean
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
  /** CSS color override for the default tab's active background */
  defaultTabActiveColor?: string
  /** Style overrides for header/footer (e.g., gradient stripes, footer background class) */
  styleOverrides?: {
    /** Inline styles for the header div (e.g., gradient backgrounds) */
    headerStyle?: React.CSSProperties
    /** Inline styles for the footer div (e.g., gradient stripes) */
    footerStyle?: React.CSSProperties
    /** CSS class override for the footer background (overrides headerBg) */
    footerBg?: string
  }
  /** Stats rendered in the header's right side (between headerContent and controls) */
  stats?: StatItem[]
  /** Custom content rendered to the left of stats in the header */
  beforeStats?: ReactNode
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
  compact: compactProp,
  listing: listingProp,
  onCardClick,
  cardClickable = false,
  controls,
  disabled = false,
  bodyPadding,
  source,
  isExpanded = true,
  borderColor: borderColorProp = 'black',
  headerTestId,
  image,
  stickyHeader = false,
  tabs,
  defaultTabLabel = 'Info',
  defaultTabActiveColor,
  styleOverrides,
  stats,
  beforeStats,
}: DisplayCardProps) {
  const isListing = !!listingProp
  const isCompact = !!compactProp
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

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (resolvedCardClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        resolvedCardClick()
      }
    },
    [resolvedCardClick]
  )

  // Sticky header: measure header height and support nesting via context
  const wrapperRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const parentStickyOffset = useContext(StickyOffsetContext)

  // Measure nav height and header height for sticky positioning
  const [measuredNavH, setMeasuredNavH] = useState(0)
  const [measuredHeaderH, setMeasuredHeaderH] = useState(0)

  useLayoutEffect(() => {
    if (!stickyHeader || !headerRef.current || !wrapperRef.current) return
    const header = headerRef.current
    const wrapper = wrapperRef.current
    const measure = () => {
      const navH = parseFloat(getComputedStyle(wrapper).getPropertyValue('--app-nav-h')) || 0
      setMeasuredNavH((prev) => (prev !== navH ? navH : prev))
      setMeasuredHeaderH((prev) => {
        const h = header.offsetHeight
        return prev !== h ? h : prev
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(header)
    return () => ro.disconnect()
  }, [stickyHeader])

  // Nested sticky: stack below parent's sticky header, or use nav height for top-level
  const stickyTop = stickyHeader ? (parentStickyOffset > 0 ? parentStickyOffset : measuredNavH) : 0
  const childStickyOffset = stickyHeader ? stickyTop + measuredHeaderH : 0

  // Set --sticky-header-h CSS variable for SectionSeparator offsets
  useEffect(() => {
    if (!stickyHeader || !wrapperRef.current) return
    wrapperRef.current.style.setProperty('--sticky-header-h', `${stickyTop + measuredHeaderH}px`)
  }, [stickyHeader, stickyTop, measuredHeaderH])

  // Use CSS variable as fallback for first render (before measurement)
  const stickyTopStyle = stickyHeader
    ? stickyTop > 0
      ? `${stickyTop}px`
      : 'var(--app-nav-h, 0px)'
    : undefined

  const defaultBodyPadding = isCompact ? 'p-2' : 'p-3'
  const borderWidth = isCompact ? 2 : 3

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
          'cursor-pointer transition-all duration-200 md:hover:z-10 md:hover:-translate-y-0.5 md:hover:scale-[1.02]'
      )}
      style={{
        ...(actualHeaderBg ? { border: `${borderWidth}px solid ${effectiveBorderColor}` } : {}),
        ...cardSourceStyles.style,
      }}
      onClick={resolvedCardClick}
      onKeyDown={resolvedCardClick ? handleCardKeyDown : undefined}
    >
      {label && !isCompact && (
        <Text
          variant="pseudoheader"
          as="span"
          className="absolute z-10 ml-3 -mt-2 text-sm uppercase"
        >
          {label}
        </Text>
      )}
      {label && isCompact && (
        <Text
          variant="pseudoheader"
          as="span"
          className="absolute top-0 z-10 ml-3 -translate-y-1/2 whitespace-nowrap text-xs uppercase"
        >
          {label}
        </Text>
      )}

      {controls && (
        <div
          className={cn(
            'absolute right-0 z-10 mr-1.5',
            isCompact ? 'top-0 -translate-y-1/2' : '-mt-2'
          )}
        >
          <ControlButtons controls={controls} compact={isCompact} />
        </div>
      )}

      {/* Inner wrapper clips backgrounds to border-radius.
          overflow-visible when stickyHeader so position:sticky and absolute overlays work.
          overflow-hidden otherwise (non-sticky cards still clip at border-radius). */}
      <div
        className={cn(
          'flex flex-1',
          stickyHeader ? 'overflow-visible' : 'overflow-hidden',
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
            ...(stickyHeader ? { top: stickyTopStyle } : {}),
          }}
        >
          {/* Content row — existing header layout */}
          <div
            className={cn(
              'flex w-full flex-wrap items-center justify-between gap-2 overflow-visible',
              isCompact ? 'min-h-[60px] px-0.5 py-1' : 'min-h-[80px] px-1.5 py-1.5',
              !isCompact && label && 'pb-4 pt-4',
              isCompact && label && 'pt-2',
              actualHeaderBg,
              headerSourceStyles.className,
              headerSourceStyles.className && 'h-full'
            )}
            style={{
              opacity: headerOpacity,
              ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
              ...styleOverrides?.headerStyle,
              ...headerSourceStyles.style,
              ...(!isListing && (children || image || footerContent || hasTabs)
                ? { borderBottom: `${borderWidth}px solid ${effectiveBorderColor}` }
                : {}),
            }}
            data-testid={headerTestId}
          >
            {beforeStats || (stats && stats.length > 0) ? (
              <>
                <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center justify-center gap-2 overflow-visible sm:basis-0 sm:justify-between">
                  {headerContent}
                </div>
                <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-1 gap-y-1 sm:w-auto sm:justify-end">
                  {beforeStats}
                  {stats && stats.length > 0 && <StatsBar stats={stats} compact={isCompact} />}
                </div>
              </>
            ) : (
              headerContent
            )}
          </div>

          {/* Tab bar — only when hasTabs */}
          {hasTabs && (
            <div className="flex flex-wrap divide-x divide-su-grey-dark/30" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={isDefaultTab}
                className={cn(
                  'min-w-0 basis-1/3 grow shrink-0 md:basis-0 md:shrink cursor-pointer border-b border-su-grey-dark/30 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide transition-colors',
                  isDefaultTab
                    ? 'text-su-black'
                    : 'bg-su-grey-light text-su-black hover:bg-su-grey-medium'
                )}
                style={
                  isDefaultTab
                    ? {
                        backgroundColor: defaultTabActiveColor
                          ? `color-mix(in srgb, ${defaultTabActiveColor} 35%, white)`
                          : activeTabBg,
                      }
                    : undefined
                }
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
                      'min-w-0 basis-1/3 grow shrink-0 md:basis-0 md:shrink cursor-pointer border-b border-su-grey-dark/30 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide transition-colors',
                      isActive
                        ? 'text-su-black'
                        : 'bg-su-grey-light text-su-black hover:bg-su-grey-medium'
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
          <StickyOffsetContext.Provider value={childStickyOffset}>
            <StickyHeaderContext.Provider value={stickyHeader}>
              <div
                className={cn(
                  'w-full flex-1 bg-su-white',
                  isDefaultTab && image
                    ? 'md:grid md:grid-cols-[auto_1fr] md:items-center'
                    : 'flex flex-col',
                  bodyPadding || defaultBodyPadding,
                  hasTabs && (isDefaultTab ? 'pt-3' : 'p-0 pt-2')
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
                    {image ? <div>{children}</div> : children}
                  </>
                ) : (
                  activeTab?.content
                )}
              </div>
            </StickyHeaderContext.Provider>
          </StickyOffsetContext.Provider>
        )}

        {/* Footer — hidden in listing mode */}
        {!isListing && footerContent && (
          <div
            className={cn(
              'flex w-full items-center justify-between px-3 py-2',
              styleOverrides?.footerBg ?? actualHeaderBg,
              footerSourceStyles.className
            )}
            style={{
              ...(headerBgColor && !styleOverrides?.footerBg
                ? { backgroundColor: headerBgColor }
                : {}),
              ...footerSourceStyles.style,
              ...styleOverrides?.footerStyle,
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
