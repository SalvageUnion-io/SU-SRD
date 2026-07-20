import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { CardControlRail } from './CardControlRail'
import { Stat } from './Stat'
import type { StatItem } from './statsBarTypes'
import { accentDeepColor, borderColorFromHeaderBg } from '../referenceEntity/referenceEntityHelpers'
import type { ReferenceEntityControl } from '../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'
import { StickyHeaderContext, StickyOffsetContext } from './StickyHeaderContext'
import { useStickyCard } from './useStickyCard'
import { CalloutMetaStamp } from '../referenceEntity/ReferenceEntityDisplay/components/CalloutMetaStamp'
import type { EntityStatus } from '../chrome/StatusBadge'
import { displayBooleans, resolveCardDisplay } from './displayMode'
import type { CardExtent, CardSize } from './displayMode'

/** Inline foot meta entry (design-spec §2.1 `.ec__metafoot`), e.g. AP COST · 1 */
export type CardFootMeta = { label: string; value: ReactNode }

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
  /** How big the card renders — `large` | `medium` | `small`. Orthogonal to
   * `extent`. The vocabulary lives in `displayMode.ts`; see it for the rungs. */
  size?: CardSize
  /** How much of the card renders — `full` | `head` | `catalog`. Orthogonal to
   * `size`, so a `small` card can still show its whole content. */
  extent?: CardExtent
  /** Intact/Damaged/Destroyed condition. Presentational sugar: it is folded
   * into a `status` CONTROL and rendered by the shared rail, so the condition
   * badge has exactly one implementation. */
  status?: EntityStatus
  /** Cycle handler for the status badge (Intact → Damaged → Destroyed) */
  onStatusClick?: () => void
  /** Entity name for the status badge's accessible label, so multiple badges
   * on one page get distinct accessible names */
  statusSubject?: string
  /** Expansion slot rendered after the body, before the footer (design-spec
   * §2.1 `.ec__expand`) — ability trees, integrated systems, bay crew insets.
   * Hidden in listing/head mode like the body. */
  expand?: ReactNode
  /** Inline label/value meta folded into the footer band (`.ec__metafoot`) */
  footMeta?: CardFootMeta[]
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
  /** Content rendered in the sub-header band, alongside/instead of `stats` —
   * a darker shade of the header tone directly below the header content row.
   * The band renders when either `subHeader` or `stats` is provided; no band
   * renders when both are empty. */
  subHeader?: ReactNode
  /** Stats rendered in the sub-header band — a darker shade of the header tone
   * directly below the header content row. No band renders when empty. */
  stats?: StatItem[]
}

const DEFAULT_TAB_KEY = '__default'

/**
 * The sub-header band's stat row — a tight, non-wrapping `[StatItem → Stat]`
 * cluster inside the wrapping band. Folded in from the former standalone `StatsBar`
 * (DisplayCard was its only consumer): each item skips when its value is undefined,
 * an `onChange` item renders the edit-mode +/- stepper (coercing a string value to
 * a number), and tooltips gate on `suppressTooltips`.
 */
function SubHeaderStats({
  stats,
  compact = false,
  suppressTooltips = false,
}: {
  stats: StatItem[]
  compact?: boolean
  suppressTooltips?: boolean
}) {
  return (
    <div className="flex items-center gap-0.5">
      {stats.map((stat) => {
        if (stat.value === undefined) return null

        if (stat.onChange) {
          return (
            <Stat
              key={stat.key}
              label={stat.label}
              value={typeof stat.value === 'number' ? stat.value : parseInt(String(stat.value), 10)}
              max={stat.outOfMax}
              bottomLabel={stat.bottomLabel}
              mode={(stat.canEdit ?? true) ? 'edit' : 'read'}
              compact={compact}
              onChange={stat.onChange}
            />
          )
        }

        return (
          <Stat
            key={stat.key}
            label={stat.label}
            value={stat.value}
            max={stat.outOfMax}
            bottomLabel={stat.bottomLabel}
            hoverText={suppressTooltips ? undefined : stat.hoverText}
            inverse={stat.inverse}
            state={stat.state}
            flash={stat.flash}
            disabled={stat.disabled}
            ariaLabel={stat.ariaLabel}
            compact={compact}
            onClick={stat.onClick}
          />
        )
      })}
    </div>
  )
}

export function DisplayCard({
  headerBg = '',
  headerBgColor,
  headerContent,
  footerContent,
  children,
  label,
  labelBadge,
  labelLead,
  size,
  extent,
  status,
  onStatusClick,
  statusSubject,
  expand,
  footMeta,
  onCardClick,
  cardClickable = false,
  controls,
  disabled = false,
  bodyPadding,
  cardStyle,
  headerStyle: headerStyleProp,
  footerStyle: footerStyleProp,
  borderColor: borderColorProp = 'var(--color-ink)',
  headerTestId,
  stickyHeader = false,
  tabs,
  defaultTabLabel = 'Info',
  defaultTabActiveColor,
  subHeader,
  stats,
}: DisplayCardProps) {
  const display = resolveCardDisplay({ size, extent })
  const { compact: isCompact, listing: isListing } = displayBooleans(display)
  const hasCallout = !!(labelLead || label || labelBadge)
  const hasTabs = !isListing && tabs && tabs.length > 0

  const [activeTabKey, setActiveTabKey] = useState(DEFAULT_TAB_KEY)

  // Derive resolved tab key — falls back to default if active tab was removed
  const resolvedTabKey =
    activeTabKey !== DEFAULT_TAB_KEY && tabs && !tabs.some((t) => t.key === activeTabKey)
      ? DEFAULT_TAB_KEY
      : activeTabKey

  // `status` is presentational sugar over the controls API: it folds into a
  // status CONTROL so the condition badge has exactly ONE implementation (the
  // shared rail), rather than a second inline rendering inside the header row.
  const railControls: ReferenceEntityControl[] = status
    ? [
        {
          key: '__status',
          status: { value: status, onClick: onStatusClick, subject: statusSubject },
        },
        ...(controls ?? []),
      ]
    : (controls ?? [])

  // Resolve card-level click: onCardClick prop → fallback to controls with cardClick
  const cardClickControls = !onCardClick && controls ? controls.filter((c) => c.cardClick) : []
  if (cardClickControls.length > 1) {
    console.warn(
      'DisplayCard: multiple controls set cardClick — last one wins',
      cardClickControls.map((c) => c.key)
    )
  }
  const resolvedCardClick = onCardClick ?? cardClickControls.at(-1)?.onClick

  // Hover effect when card is clickable (via handler or boolean flag)
  const isCardHoverable = !!resolvedCardClick || cardClickable

  const actualHeaderBg = headerBg
  // Border colour equals the tone (header background) itself when a header bg is
  // set, matching the codex "After" .a-card spec; falls back to the ink
  // default (borderColorProp) when there is no header bg.
  const effectiveBorderColor = borderColorFromHeaderBg(headerBg, headerBgColor) ?? borderColorProp

  // Sub-header band (design-spec four-band model): a darker shade of the
  // header tone, sitting flush below the header content row. Optional —
  // populated by `subHeader` content and/or `stats`; no band when both are empty.
  const subHeaderBg = accentDeepColor(headerBg, headerBgColor) ?? 'var(--color-ink)'
  const hasStats = !!stats && stats.length > 0
  const hasSubHeader = !!subHeader || hasStats

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
  // 3px for both compact and non-compact — the codex .a-card is 3px and .cx does
  // not override it.
  const borderWidth = 3

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
    // biome-ignore lint/a11y/noStaticElementInteractions: role="button" + tabIndex + keyboard handler are applied whenever resolvedCardClick makes the card interactive
    <div
      ref={stickyWrapperRef}
      role={resolvedCardClick ? 'button' : undefined}
      tabIndex={resolvedCardClick ? 0 : undefined}
      className={cn(
        'relative flex shrink-0 flex-col overflow-visible rounded-card',
        cardStyle?.className || 'shadow-lg',
        disabled && 'opacity-50',
        // Focus ring for button mode: uses a dark inner ring + white outer offset
        // so the outline stays visible on both light backgrounds (e.g., bg-paper)
        // and dark tech-level backgrounds (e.g., tl-5/tl-6).
        resolvedCardClick &&
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
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
              A lone label or badge stays a single dark stamp.
              The seam stamp is ALWAYS the small (compact) size so it reads as a
              tag riding the border, subordinate to the header — never card
              `compact`, which only governs the body/header density. */}
          {label && labelBadge ? (
            <Stat orientation="horizontal" label={label} value={labelBadge} xs />
          ) : label ? (
            <CalloutMetaStamp xs>{label}</CalloutMetaStamp>
          ) : labelBadge ? (
            <CalloutMetaStamp xs>{labelBadge}</CalloutMetaStamp>
          ) : null}
        </div>
      )}

      <CardControlRail controls={railControls} compact={isCompact} />

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
              isCompact ? 'min-h-[34px] px-2.5 py-1.5' : 'min-h-[44px] px-3 py-2',
              // Top padding clears the callout so the gap below it is consistent.
              // Non-compact: the callout seam is now the small (compact) stamp,
              // so pt-5 clears it uniformly with a thin gap and never runs into
              // the title.
              // Compact: callout sits centred on the edge (~8px of it below the
              // top) → pt-3 ≈ 4px gap, tighter to suit dense listings.
              !isCompact && hasCallout && 'pb-4 pt-5',
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
            {headerContent}
          </div>

          {/* Sub-header band (design-spec four-band model) — a darker shade of
              the header tone, directly below the header content row. Carries
              `subHeader` content and/or `stats` (moved out of the header's
              right side), full width, flush to the frame. Both are optional;
              renders nothing when neither is present. */}
          {hasSubHeader && (
            <div
              className={cn(
                'flex w-full flex-wrap items-center gap-1.5 gap-y-1 overflow-visible',
                isCompact ? 'px-2.5 py-1' : 'px-3 py-1.5'
              )}
              style={{ backgroundColor: subHeaderBg }}
            >
              {subHeader}
              {hasStats && <SubHeaderStats stats={stats ?? []} compact={isCompact} />}
            </div>
          )}

          {/* Tab bar — only when hasTabs */}
          {hasTabs &&
            (() => {
              const beforeTabs = tabs.filter((t) => t.before)
              const afterTabs = tabs.filter((t) => !t.before)

              const tabBaseClass =
                'min-w-0 basis-1/3 grow shrink-0 md:basis-0 md:shrink cursor-pointer px-3 py-1.5 font-cond text-xs font-bold uppercase tracking-caps transition-colors'

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
                      !tab.borderColor && 'border-b border-ink-2/30',
                      isActive ? 'text-ink' : 'bg-wk-faint text-ink hover:bg-wk-muted'
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
                <div className="flex flex-wrap divide-x divide-ink-2/30" role="tablist">
                  {beforeTabs.map(renderTabButton)}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isDefaultTab}
                    className={cn(
                      tabBaseClass,
                      'border-b border-ink-2/30',
                      isDefaultTab ? 'text-ink' : 'bg-wk-faint text-ink hover:bg-wk-muted'
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
                  'w-full flex-1 isolate bg-paper flex flex-col',
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

        {/* Expansion slot — after the body, before the footer (.ec__expand).
            Hidden in listing mode like the body. */}
        {!isListing && expand && <div className="w-full">{expand}</div>}

        {/* Footer — hidden in listing mode. Renders when there is footer
            content OR foot extras (actions/meta) to fold into the band. */}
        {!isListing && (footerContent || (footMeta && footMeta.length > 0)) && (
          <div
            className={cn(
              'flex w-full items-center justify-between gap-2 px-3 py-1 font-cond text-micro font-bold uppercase tracking-[0.05em] text-paper',
              footerStyleProp?.className
            )}
            style={{
              // Footer is the DARKER shade (matches the sub-header + the
              // reference-entity footer), not the header tone.
              ...(!footerStyleProp?.className ? { backgroundColor: subHeaderBg } : {}),
              ...footerStyleProp?.style,
            }}
          >
            {footerContent}
            {footMeta && footMeta.length > 0 && (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                {footMeta.map(({ label: metaLabel, value }, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: footMeta is a static per-render list; index disambiguates repeated labels
                  <span key={`${metaLabel}-${i}`} className="mr-1 inline-flex items-baseline gap-1">
                    <span className="font-cond text-micro font-bold uppercase leading-none tracking-[0.05em] opacity-75">
                      {metaLabel}
                    </span>
                    <span className="font-body text-caption font-bold leading-none">{value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
