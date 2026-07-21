import { useCallback } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { CardControlRail } from './CardControlRail'
import { Stat } from './Stat'
import type { StatItem } from './statsBarTypes'
import { accentDeepColor, borderColorFromHeaderBg } from '../referenceEntity/referenceEntityHelpers'
import type { ReferenceEntityControl } from '../referenceEntity/referenceEntityControlTypes'
import { Badge } from '../chrome/Badge'
import type { EntityStatus } from '../chrome/StatusBadge'
import { displayBooleans, resolveCardDisplay } from './displayMode'
import type { CardExtent, CardSize } from './displayMode'
import { foldStatusControl } from './foldStatusControl'

/** Inline foot meta entry (design-spec §2.1 `.ec__metafoot`), e.g. AP COST · 1 */
export type CardFootMeta = { label: string; value: ReactNode }

type DisplayCardProps = {
  /** Background color class for header and footer (e.g., "bg-mech"). Default: "" */
  headerBg?: string
  /** Optional CSS color for border derivation */
  headerBgColor?: string
  /** Content rendered inside the header bar. Omit it and NO header band is
   * painted — a card that has nothing to put in the band shouldn't render an
   * empty one. (The sub-header band is independent of this.) */
  headerContent?: ReactNode
  /** Content rendered inside the footer bar (optional) */
  footerContent?: ReactNode
  /** Main body content */
  children?: ReactNode
  /** Optional pseudoheader label above the card */
  label?: string
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
  cardStyle?: { className?: string; style?: CSSProperties }
  /** Override header className and inline style (e.g., the pilot/crawler stripe accent) */
  headerStyle?: { className?: string; style?: CSSProperties }
  /** CSS color for card borders (external + internal). Defaults to 'black'. */
  borderColor?: string
  /** Content rendered in the sub-header band, alongside/instead of `stats` —
   * a darker shade of the header tone directly below the header content row.
   * The band renders when either `subHeader` or `stats` is provided; no band
   * renders when both are empty. */
  subHeader?: ReactNode
  /** Stats rendered in the sub-header band — a darker shade of the header tone
   * directly below the header content row. No band renders when empty. */
  stats?: StatItem[]
}

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
              size={compact ? 'mini' : 'compact'}
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
            size={compact ? 'mini' : 'compact'}
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
  size,
  extent,
  status,
  onStatusClick,
  statusSubject,
  expand,
  footMeta,
  onCardClick,
  controls,
  disabled = false,
  bodyPadding,
  cardStyle,
  headerStyle: headerStyleProp,
  borderColor: borderColorProp,
  subHeader,
  stats,
}: DisplayCardProps) {
  const display = resolveCardDisplay({ size, extent })
  const { compact: isCompact, listing: isListing } = displayBooleans(display)
  const hasCallout = !!label

  // `status` is presentational sugar over the controls API: it folds into a
  // status CONTROL so the condition badge has exactly ONE implementation (the
  // shared rail), rather than a second inline rendering inside the header row.
  const railControls = foldStatusControl(controls, status, {
    onClick: onStatusClick,
    subject: statusSubject,
  })

  // Resolve card-level click: onCardClick prop → fallback to controls with
  // cardClick (when multiple controls set it, the last one wins).
  const cardClickControls = !onCardClick && controls ? controls.filter((c) => c.cardClick) : []
  const resolvedCardClick = onCardClick ?? cardClickControls.at(-1)?.onClick

  // Hover effect when card is clickable (via handler or boolean flag)
  const isCardHoverable = !!resolvedCardClick

  // An EXPLICIT `borderColor` wins. Otherwise the border equals the tone (header
  // background) itself, matching the codex "After" .a-card spec, and falls back
  // to ink when there is no header bg.
  //
  // The precedence used to be the other way round, which meant a caller passing
  // both a header bg and a `borderColor` had its `borderColor` silently
  // discarded — the frame is meant to be settable independently of the band
  // (an accent frame around a tinted header is the whole shape of a Callout).
  const effectiveBorderColor =
    borderColorProp ?? borderColorFromHeaderBg(headerBg, headerBgColor) ?? 'var(--color-ink)'

  // Sub-header band (design-spec four-band model): a darker shade of the
  // header tone, sitting flush below the header content row. Optional —
  // populated by `subHeader` content and/or `stats`; no band when both are empty.
  const subHeaderBg = accentDeepColor(headerBg, headerBgColor) ?? 'var(--color-ink)'
  const hasStats = !!stats && stats.length > 0
  const hasSubHeader = !!subHeader || hasStats

  const handleCardKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (resolvedCardClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        resolvedCardClick()
      }
    },
    [resolvedCardClick]
  )

  const defaultBodyPadding = 'p-0'
  // 3px for both compact and non-compact — the codex .a-card is 3px and .cx does
  // not override it.
  const borderWidth = 3

  const showBody = !isListing && !!children

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role="button" + tabIndex + keyboard handler are applied whenever resolvedCardClick makes the card interactive
    <div
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
        // A frame is drawn for a toned card OR one that asked for a border
        // outright; an untoned, unframed card still renders borderless.
        ...(headerBg || headerBgColor || borderColorProp
          ? { border: `${borderWidth}px solid ${effectiveBorderColor}` }
          : {}),
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
          {/* The seam stamp is ALWAYS the small (compact) size so it reads as a
              tag riding the border, subordinate to the header — never card
              `compact`, which only governs the body/header density. */}
          <Badge shape="stamp" size="mini">
            {label}
          </Badge>
        </div>
      )}

      <CardControlRail controls={railControls} compact={isCompact} />

      {/* Inner wrapper clips backgrounds to border-radius. */}
      <div
        className={cn('flex flex-1 overflow-hidden', !isListing && 'flex-col')}
        style={{ borderRadius: `calc(3px - ${borderWidth}px)` }}
      >
        {/* Header wrapper — contains the content row. */}
        <div className="w-full">
          {/* Content row — existing header layout */}
          {headerContent != null && (
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
                headerBg,
                headerStyleProp?.className,
                headerStyleProp?.className && 'h-full'
              )}
              style={{
                ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
                ...headerStyleProp?.style,
              }}
            >
              {headerContent}
            </div>
          )}

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
        </div>

        {/* Body — hidden in listing mode */}
        {showBody && (
          <div
            className={cn(
              'w-full flex-1 isolate bg-paper flex flex-col',
              bodyPadding || defaultBodyPadding
            )}
          >
            {children}
          </div>
        )}

        {/* Expansion slot — after the body, before the footer (.ec__expand).
            Hidden in listing mode like the body. */}
        {!isListing && expand && <div className="w-full">{expand}</div>}

        {/* Footer — hidden in listing mode. Renders when there is footer
            content OR foot extras (actions/meta) to fold into the band. */}
        {!isListing && (footerContent || (footMeta && footMeta.length > 0)) && (
          <div
            className="flex w-full items-center justify-between gap-2 px-3 py-1 font-cond text-micro font-bold uppercase tracking-caps-tight text-paper"
            // Footer is the DARKER shade (matches the sub-header + the
            // reference-entity footer), not the header tone.
            style={{ backgroundColor: subHeaderBg }}
          >
            {footerContent}
            {footMeta && footMeta.length > 0 && (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                {footMeta.map(({ label: metaLabel, value }, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: footMeta is a static per-render list; index disambiguates repeated labels
                  <span key={`${metaLabel}-${i}`} className="mr-1 inline-flex items-baseline gap-1">
                    <span className="font-cond text-micro font-bold uppercase leading-none tracking-caps-tight opacity-75">
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
