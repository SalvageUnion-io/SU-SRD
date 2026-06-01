import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { ControlButtons } from './ControlButtons'
import { StatsBar } from './StatsBar'
import { ValueDisplay } from './ValueDisplay'
import type { StatItem } from './statsBarTypes'
import { borderColorFromHeaderBg } from '../referenceEntity/referenceEntityHelpers'
import type { ReferenceEntityControl } from '../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'
import { StickyHeaderContext, StickyOffsetContext } from './StickyHeaderContext'
import { useStickyCard } from './useStickyCard'
import { CalloutMetaStamp } from '../referenceEntity/ReferenceEntityDisplay/components/CalloutMetaStamp'

export type DisplayCardTab = {
  key: string
  label: string
  content: ReactNode
  /** CSS color override for the active-tab background (defaults to header-derived tint) */
  activeColor?: string
  /** Place this tab before the default tab instead of after */
  before?: boolean
  /** CSS color for a persistent bottom border on this tab (visible even when inactive) */
  borderColor?: string
  /** CSS color for a persistent glow (box-shadow) around the tab button */
  glowColor?: string
}

type DisplayCardProps = {
  /** Background color class for header and footer (e.g., "bg-su-green"). Default: "" */
  headerBg?: string
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
  /** Optional small badge rendered as a second stamp beside the label (e.g. ability level) */
  labelBadge?: string
  /** Optional node rendered FIRST in the label callout row (e.g. a "Recommended" stamp) */
  labelLead?: ReactNode
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
  /** Override default body padding (default: "p-0") */
  bodyPadding?: string
  /** Override card wrapper className (replaces default shadow) and inline style */
  cardStyle?: { className?: string; style?: React.CSSProperties }
  /** Override header className and inline style (e.g., the pilot/crawler stripe accent) */
  headerStyle?: { className?: string; style?: React.CSSProperties }
  /** Override footer className and inline style */
  footerStyle?: { className?: string; style?: React.CSSProperties }
  /** data-testid on the header div */
  headerTestId?: string
  /** CSS color for card borders (external + internal). Defaults to 'black'. */
  borderColor?: string
  /** Make header sticky when scrolling. Section separators inside the card auto-stick below. */
  stickyHeader?: boolean
  /** Additional tabs beyond the default content. Ignored in listing mode. */
  tabs?: DisplayCardTab[]
  /** Label for the default (children) tab. Defaults to "Info". */
  defaultTabLabel?: string
  /** CSS color override for the default tab's active background */
  defaultTabActiveColor?: string
  /** Stats rendered in the header's right side (between headerContent and controls) */
  stats?: StatItem[]
}

const DEFAULT_TAB_KEY = '__default'

export function DisplayCard({
  headerBg = '',
  headerBgColor,
  headerContent,
  footerContent,
  children,
  label,
  labelBadge,
  labelLead,
  compact: compactProp,
  listing: listingProp,
  onCardClick,
  cardClickable = false,
  controls,
  disabled = false,
  bodyPadding,
  cardStyle,
  headerStyle: headerStyleProp,
  footerStyle: footerStyleProp,
  borderColor: borderColorProp = 'var(--color-su-black)',
  headerTestId,
  stickyHeader = false,
  tabs,
  defaultTabLabel = 'Info',
  defaultTabActiveColor,
  stats,
}: DisplayCardProps) {
  const isListing = !!listingProp
  const isCompact = !!compactProp
  const hasCallout = !!(labelLead || label || labelBadge)
  const hasTabs = !isListing && tabs && tabs.length > 0

  const [activeTabKey, setActiveTabKey] = useState(DEFAULT_TAB_KEY)

  // Derive resolved tab key — falls back to default if active tab was removed
  const resolvedTabKey =
    activeTabKey !== DEFAULT_TAB_KEY && tabs && !tabs.some((t) => t.key === activeTabKey)
      ? DEFAULT_TAB_KEY
      : activeTabKey

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
  const effectiveBorderColor = borderColorProp

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (resolvedCardClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        resolvedCardClick()
      }
    },
    [resolvedCardClick]
  )

  const {
    wrapperRef: stickyWrapperRef,
    headerRef: stickyHeaderRef,
    stickyTopStyle,
    childStickyOffset,
    isSticky,
  } = useStickyCard(stickyHeader)

  const defaultBodyPadding = 'p-0'
  const borderWidth = isCompact ? 2 : 3

  const isDefaultTab = resolvedTabKey === DEFAULT_TAB_KEY
  const activeTab = hasTabs ? tabs.find((t) => t.key === resolvedTabKey) : undefined
  const showBody = !isListing && (isDefaultTab ? !!children : !!activeTab)

  // Pale version of header color for active tab background
  const activeTabBg = hasTabs
    ? (() => {
        const cssColor = borderColorFromHeaderBg(headerBg, headerBgColor)
        return cssColor ? `color-mix(in srgb, ${cssColor} 35%, white)` : undefined
      })()
    : undefined

  return (
    <div
      ref={stickyWrapperRef}
      role={resolvedCardClick ? 'button' : undefined}
      tabIndex={resolvedCardClick ? 0 : undefined}
      className={cn(
        'relative flex shrink-0 flex-col overflow-visible rounded-[3px]',
        cardStyle?.className || 'shadow-lg',
        disabled && 'opacity-50',
        // Focus ring for button mode: uses a dark inner ring + white outer offset
        // so the outline stays visible on both light backgrounds (e.g., bg-su-white)
        // and dark tech-level backgrounds (e.g., tl-5/tl-6).
        resolvedCardClick &&
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-su-black focus-visible:ring-offset-2 focus-visible:ring-offset-su-white',
        isCardHoverable &&
          'cursor-pointer transition-all duration-200 md:hover:z-10 md:hover:-translate-y-0.5 md:hover:scale-[1.02]'
      )}
      style={{
        ...(actualHeaderBg ? { border: `${borderWidth}px solid ${effectiveBorderColor}` } : {}),
        ...cardStyle?.style,
      }}
      onClick={resolvedCardClick}
      onKeyDown={resolvedCardClick ? handleCardKeyDown : undefined}
    >
      {hasCallout && (
        <div
          className={cn(
            'absolute z-30 ml-3 flex items-center gap-1',
            isCompact ? 'top-0 -translate-y-1/2' : '-mt-2'
          )}
        >
          {labelLead}
          {/* A label + badge pair (e.g. TECH LEVEL · 1, or a tree + ability level)
              renders as one segmented value — label on the dark stamp, value in a
              bounded white box — matching the data-row tags (e.g. RANGE · LONG).
              A lone label or badge stays a single dark stamp. */}
          {label && labelBadge ? (
            <ValueDisplay label={label} value={labelBadge} compact={isCompact} />
          ) : label ? (
            <CalloutMetaStamp>{label}</CalloutMetaStamp>
          ) : labelBadge ? (
            <CalloutMetaStamp>{labelBadge}</CalloutMetaStamp>
          ) : null}
        </div>
      )}

      {controls && (
        <div
          className={cn(
            'absolute right-0 z-30 mr-1.5',
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
          isSticky ? 'overflow-visible' : 'overflow-hidden',
          !isListing && 'flex-col'
        )}
        style={{ borderRadius: `calc(3px - ${borderWidth}px)` }}
      >
        {/* Header wrapper — contains content row + optional tab bar.
            When stickyHeader, both stick together. headerRef measures the full height. */}
        <div
          ref={stickyHeaderRef}
          className={cn('w-full', hasTabs && 'flex flex-col', isSticky && 'sticky z-20')}
          style={{
            ...(isSticky ? { top: stickyTopStyle } : {}),
          }}
        >
          {/* Content row — existing header layout */}
          <div
            className={cn(
              'flex w-full flex-wrap justify-between gap-2 overflow-visible',
              // Vertically centre the header content normally, but TOP-align it when
              // the floating callout row is present (non-compact). Centring made the
              // gap below the callout vary with header height — short headers
              // (modules/systems) centred high and collided with the callout, tall
              // ones (chassis) sat low. Top-aligning + a fixed top padding gives a
              // consistent thin gap under the callout regardless of content height.
              hasCallout ? 'items-start' : 'items-center',
              // px-3 (12px) aligns the header content L/R extremes with the
              // inset white body block (which uses mx-3) and the footer.
              isCompact ? 'min-h-[60px] px-3 py-1' : 'min-h-[80px] px-3 py-1.5',
              // Top padding clears the callout so the gap below it is consistent.
              // Non-compact: callout straddles ~8px above the top → pt-4 ≈ 8px gap.
              // Compact: callout sits centred on the edge (~8px of it below the
              // top) → pt-3 ≈ 4px gap, tighter to suit dense listings.
              !isCompact && hasCallout && 'pb-4 pt-4',
              isCompact && hasCallout && 'pt-3',
              actualHeaderBg,
              headerStyleProp?.className,
              headerStyleProp?.className && 'h-full'
            )}
            style={{
              ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
              ...headerStyleProp?.style,
            }}
            data-testid={headerTestId}
          >
            {stats && stats.length > 0 ? (
              <>
                <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center justify-center gap-2 overflow-visible sm:basis-0 sm:justify-between">
                  {headerContent}
                </div>
                <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-1 gap-y-1 sm:w-auto sm:justify-end">
                  <StatsBar stats={stats} compact={isCompact} />
                </div>
              </>
            ) : (
              headerContent
            )}
          </div>

          {/* Tab bar — only when hasTabs */}
          {hasTabs &&
            (() => {
              const beforeTabs = tabs.filter((t) => t.before)
              const afterTabs = tabs.filter((t) => !t.before)

              const tabBaseClass =
                'min-w-0 basis-1/3 grow shrink-0 md:basis-0 md:shrink cursor-pointer px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide transition-colors'

              const renderTabButton = (tab: DisplayCardTab) => {
                const isActive = resolvedTabKey === tab.key
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
                      tabBaseClass,
                      !tab.borderColor && 'border-b border-su-grey-dark/30',
                      isActive
                        ? 'text-su-black'
                        : 'bg-su-grey-light text-su-black hover:bg-su-grey-medium'
                    )}
                    style={{
                      ...(isActive && tabBg ? { backgroundColor: tabBg } : {}),
                      ...(tab.borderColor ? { borderBottom: `3px solid ${tab.borderColor}` } : {}),
                      ...(tab.glowColor ? { boxShadow: `0 0 8px 2px ${tab.glowColor}` } : {}),
                    }}
                    onClick={() => setActiveTabKey(tab.key)}
                  >
                    {tab.label}
                  </button>
                )
              }

              return (
                <div className="flex flex-wrap divide-x divide-su-grey-dark/30" role="tablist">
                  {beforeTabs.map(renderTabButton)}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isDefaultTab}
                    className={cn(
                      tabBaseClass,
                      'border-b border-su-grey-dark/30',
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
                  {afterTabs.map(renderTabButton)}
                </div>
              )
            })()}
        </div>

        {/* Body — hidden in listing mode */}
        {showBody && (
          <StickyOffsetContext.Provider value={childStickyOffset}>
            <StickyHeaderContext.Provider value={isSticky}>
              <div
                className={cn(
                  'w-full flex-1 isolate bg-su-white flex flex-col',
                  bodyPadding || defaultBodyPadding,
                  hasTabs && (isDefaultTab ? 'pt-3' : 'p-0 pt-2')
                )}
                {...(hasTabs ? { 'aria-live': 'polite' as const } : {})}
              >
                {isDefaultTab ? children : activeTab?.content}
              </div>
            </StickyHeaderContext.Provider>
          </StickyOffsetContext.Provider>
        )}

        {/* Footer — hidden in listing mode */}
        {!isListing && footerContent && (
          <div
            className={cn(
              'flex w-full items-center justify-between px-3 py-2',
              footerStyleProp?.className ?? actualHeaderBg
            )}
            style={{
              ...(headerBgColor && !footerStyleProp?.className
                ? { backgroundColor: headerBgColor }
                : {}),
              ...footerStyleProp?.style,
            }}
          >
            {footerContent}
          </div>
        )}
      </div>
    </div>
  )
}
