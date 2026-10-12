import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { useCallback } from 'react'
import { foregroundOn } from '../../design/contrast'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { Badge } from '../atoms/Badge'
import type { EntityStatus } from '../atoms/entityStatus'
import { FOCUS_RING_ON_TONE } from '../atoms/interaction'
import { Stat } from '../atoms/Stat'
import type { ReferenceEntityControl } from '../referenceEntity/referenceEntityControlTypes'
import {
  accentDeepColor,
  borderColorFromHeaderBg,
  textBand,
} from '../referenceEntity/referenceEntityHelpers'
import { CardControlRail } from './CardControlRail'
import type { CardExtent, CardSize } from './displayMode'
import { displayBooleans, resolveCardDisplay } from './displayMode'
import { foldStatusControl } from './foldStatusControl'
import type { StatItem } from './statsBarTypes'

/** Inline foot meta entry (design-spec §2.1 `.ec__metafoot`), e.g. AP COST · 1 */
export type CardFootMeta = { label: string; value: ReactNode }

type CardProps = {
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
  /** Extra classes on the body band, e.g. its padding (default: none). */
  bodyPadding?: string
  /**
   * Inline style on the body band. The case it exists for: a height-capped
   * card whose body owns its own scroll (EntitySearcher in a picker modal)
   * passes `{ minHeight: 0 }`, so the body can shrink below its content and
   * the scroll lands inside it instead of the card clipping its foot.
   */
  bodyStyle?: CSSProperties
  /** Extra card wrapper className and inline style. */
  cardStyle?: { className?: string; style?: CSSProperties }
  /** Override header className and inline style (e.g., the pilot/crawler stripe accent) */
  headerStyle?: { className?: string; style?: CSSProperties }
  /** CSS color for card borders (external + internal). Defaults to 'black'. */
  borderColor?: string
  /** Frame WEIGHT — which `--bw-*` rung the card's border is drawn at. Orthogonal
   * to `borderColor` (which colour) and to `size` (how big).
   *
   * - `entity` (default, `--bw-entity` 3px) — the standalone card frame.
   * - `chrome` (`--bw-chrome` 1.5px) — the sub-panel weight, for a boxed card
   *   nested INSIDE another card's body or expand slot. A nested panel wearing
   *   the full 3px entity frame competes with its parent's frame; the border
   *   glossary (ruleset §4.3) already reserves chrome for exactly this.
   *
   * This is a rung, not an escape hatch: the weight was hardcoded at 3px, which
   * is why `Inset` hand-rolled its own frame instead of composing Card. */
  frame?: 'entity' | 'chrome'
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
 * cluster inside the wrapping band: each item skips when its value is undefined,
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
    <div style={STATS_ROW}>
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

const STATS_ROW = { display: 'flex', alignItems: 'center', gap: space[2] } satisfies CSSProperties

/** The label stamp riding the top border. */
const CALLOUT_ROW = {
  position: 'absolute',
  zIndex: 30,
  marginLeft: space[12],
  display: 'flex',
  alignItems: 'center',
  gap: space[4],
} satisfies CSSProperties

const SUB_HEADER = {
  display: 'flex',
  width: '100%',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: space[6],
  rowGap: space[4],
  overflow: 'visible',
} satisfies CSSProperties

const FOOTER = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[8],
  padding: `${space[4]} ${space[12]}`,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tracking.capsTight,
} satisfies CSSProperties

const FOOT_META = {
  marginLeft: 'auto',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: space[6],
} satisfies CSSProperties

const FOOT_META_ENTRY = {
  marginRight: space[4],
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: space[4],
} satisfies CSSProperties

const FOOT_META_LABEL = {
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  lineHeight: 1,
  letterSpacing: tracking.capsTight,
} satisfies CSSProperties

const FOOT_META_VALUE = {
  fontFamily: font.body,
  fontSize: fontSize.caption,
  fontWeight: weight.bold,
  lineHeight: 1,
} satisfies CSSProperties

const FULL_WIDTH = { width: '100%' } satisfies CSSProperties

export function Card({
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
  expand,
  footMeta,
  onCardClick,
  controls,
  disabled = false,
  bodyPadding,
  bodyStyle,
  cardStyle,
  headerStyle: headerStyleProp,
  borderColor: borderColorProp,
  frame = 'entity',
  subHeader,
  stats,
}: CardProps) {
  const display = resolveCardDisplay({ size, extent })
  const { compact: isCompact, listing: isListing } = displayBooleans(display)
  const hasCallout = !!label

  // `status` is presentational sugar over the controls API: it folds into a
  // status CONTROL so the condition badge has exactly ONE implementation (the
  // shared rail), rather than a second inline rendering inside the header row.
  const railControls = foldStatusControl(controls, status, { onClick: onStatusClick })

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
  // The frame is settable independently of the band (an accent frame around a
  // tinted header is the whole shape of a Callout), so a caller passing both a
  // header bg and a `borderColor` keeps its `borderColor`.
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

  // Frame weight comes from the border glossary, not a literal: `entity` (3px)
  // for both compact and non-compact — the codex .a-card is 3px and .cx does
  // not override it — and `chrome` (1.5px) for a card nested inside another.
  const borderWidth = frame === 'chrome' ? 'var(--bw-chrome)' : 'var(--bw-entity)'

  const showBody = !isListing && !!children
  /**
   * Does a FOOTER band render? The footer is what closes a card — a solid strip
   * of the deep tone across its foot. Without one, the frame's own border is
   * the only thing terminating the card, and at the same width as its sides it
   * reads thin under the weight of the header band. It doubles in the footer's
   * place. Mirrors the same rule in `ReferenceEntityCard`.
   */
  const rendersFooter = !isListing && Boolean(footerContent || (footMeta && footMeta.length > 0))

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role="button" + tabIndex + keyboard handler are applied whenever resolvedCardClick makes the card interactive
    <div
      role={resolvedCardClick ? 'button' : undefined}
      tabIndex={resolvedCardClick ? 0 : undefined}
      className={cn(
        // Flat chrome (brand refresh P2a): no drop shadow and no hover lift — a card is
        // printed on the page, and the 3px frame is its edge. `.su-card` is a
        // class, not a style object, so a caller's `cardStyle.className` can
        // still override it.
        'su-card',
        cardStyle?.className,
        // Button mode focuses ON TONE — a card's own background may be any
        // entity tone, including the near-black end of the tech-level ramp,
        // where the 25%-alpha rust ring disappears. See FOCUS_RING_ON_TONE.
        resolvedCardClick && FOCUS_RING_ON_TONE
      )}
      style={{
        ...(disabled ? { opacity: 0.5 } : {}),
        ...(isCardHoverable ? { cursor: 'pointer' } : {}),
        // A frame is drawn for a toned card OR one that asked for a border
        // outright; an untoned, unframed card still renders borderless.
        ...(headerBg || headerBgColor || borderColorProp
          ? // Longhand, not the `border` shorthand: a shorthand carrying `var()`
            // is valid CSS but is mis-parsed by happy-dom (it re-serialises
            // `border: var(--bw-chrome) solid var(--color-ink)` as
            // `border-width: var(--color-ink)`), so the shorthand is untestable
            // in this repo's test environment. Longhand is unambiguous in both.
            // Widths are per side because the foot varies: React warns when a
            // re-render changes a longhand that a shorthand in the same object covers.
            {
              borderStyle: 'solid',
              borderColor: effectiveBorderColor,
              borderTopWidth: borderWidth,
              borderRightWidth: borderWidth,
              borderBottomWidth: rendersFooter ? borderWidth : `calc(${borderWidth} * 2)`,
              borderLeftWidth: borderWidth,
            }
          : {}),
        ...cardStyle?.style,
      }}
      onClick={resolvedCardClick}
      onKeyDown={resolvedCardClick ? handleCardKeyDown : undefined}
    >
      {hasCallout && (
        <div
          style={{
            ...CALLOUT_ROW,
            ...(isCompact ? { top: 0, translate: '0 -50%' } : { marginTop: `-${space[8]}` }),
          }}
        >
          {/* The seam stamp is ALWAYS the small (compact) size so it reads as a
              tag riding the border, subordinate to the header — never card
              `compact`, which only governs the body/header density. */}
          <Badge shape="stamp" size="mini">
            {label}
          </Badge>
        </div>
      )}

      <CardControlRail controls={railControls} />

      {/* Inner wrapper clips backgrounds to border-radius. */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          ...(isListing ? {} : { flexDirection: 'column' }),
          borderRadius: `calc(var(--radius-card) - ${borderWidth})`,
        }}
      >
        {/* Header wrapper — contains the content row. */}
        <div style={FULL_WIDTH}>
          {/* Content row — existing header layout */}
          {headerContent != null && (
            <div
              // `.su-card-head` (`styles/index.css`) is a class, not a style
              // object, so a caller's `headerStyle.className` can override it
              // (the Callout band drops the min-height). Its density and the
              // callout clearance key off these two attributes.
              data-compact={isCompact || undefined}
              data-callout={hasCallout || undefined}
              className={cn('su-card-head', headerBg, headerStyleProp?.className)}
              style={{
                ...(headerStyleProp?.className ? { height: '100%' } : {}),
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
              style={{
                ...SUB_HEADER,
                padding: isCompact ? `${space[4]} ${space[10]}` : `${space[6]} ${space[12]}`,
                backgroundColor: subHeaderBg,
              }}
            >
              {subHeader}
              {hasStats && <SubHeaderStats stats={stats ?? []} compact={isCompact} />}
            </div>
          )}
        </div>

        {/* Body — hidden in listing mode */}
        {showBody && (
          // A class, so a caller's `bodyPadding` classes can override it.
          <div className={cn('su-card-body', bodyPadding)} style={bodyStyle}>
            {children}
          </div>
        )}

        {/* Expansion slot — after the body, before the footer (.ec__expand).
            Hidden in listing mode like the body. */}
        {!isListing && expand && <div style={FULL_WIDTH}>{expand}</div>}

        {/* Footer — hidden in listing mode. Renders when there is footer
            content OR foot extras (actions/meta) to fold into the band. */}
        {!isListing && (footerContent || (footMeta && footMeta.length > 0)) && (
          <div
            style={{
              ...FOOTER,
              // Ink or paper by contrast with the band actually painted.
              color:
                foregroundOn(textBand(subHeaderBg), 'paper') === 'ink' ? color.ink : color.paper,
              // Footer is the DARKER shade (matches the sub-header + the
              // reference-entity footer), not the header tone.
              backgroundColor: subHeaderBg,
            }}
          >
            {footerContent}
            {footMeta && footMeta.length > 0 && (
              <div style={FOOT_META}>
                {footMeta.map(({ label: metaLabel, value }, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: footMeta is a static per-render list; index disambiguates repeated labels
                  <span key={`${metaLabel}-${i}`} style={FOOT_META_ENTRY}>
                    <span style={FOOT_META_LABEL}>{metaLabel}</span>
                    <span style={FOOT_META_VALUE}>{value}</span>
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
