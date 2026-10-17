import type { CSSProperties, ReactNode } from 'react'
import { foregroundOn } from '../../design/contrast'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { Badge } from '../atoms/Badge'
import { accentDeepColor, textBand } from '../referenceEntity/referenceEntityHelpers'
import type { CardExtent, CardSize } from './displayMode'
import { displayBooleans, resolveCardDisplay } from './displayMode'

/** Inline foot meta entry (design-spec §2.1 `.ec__metafoot`), e.g. AP COST · 1 */
export type CardFootMeta = { label: string; value: ReactNode }

type CardProps = {
  /** CSS colour of the header band; the frame and the deep sub-header/footer
   * bands derive from it. */
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
  /** How big the card renders — `full` | `compact` | `mini`. Orthogonal to
   * `extent`. The vocabulary lives in `displayMode.ts`; see it for the rungs. */
  size?: CardSize
  /** How much of the card renders — `full` | `head` | `catalog`. Orthogonal to
   * `size`, so a `mini` card can still show its whole content. */
  extent?: CardExtent
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
  /** Content rendered in the sub-header band — a darker shade of the header
   * tone directly below the header content row. No band renders when empty. */
  subHeader?: ReactNode
}

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

const FULL_WIDTH = { width: '100%' } satisfies CSSProperties

export function Card({
  headerBgColor,
  headerContent,
  footerContent,
  children,
  label,
  size,
  extent,
  bodyStyle,
  cardStyle,
  headerStyle: headerStyleProp,
  borderColor: borderColorProp,
  frame = 'entity',
  subHeader,
}: CardProps) {
  const display = resolveCardDisplay({ size, extent })
  const { compact: isCompact, listing: isListing } = displayBooleans(display)
  const hasCallout = !!label

  // An EXPLICIT `borderColor` wins. Otherwise the border equals the tone (header
  // background) itself, matching the codex "After" .a-card spec, and falls back
  // to ink when there is no header bg.
  //
  // The frame is settable independently of the band (an accent frame around a
  // tinted header is the whole shape of a Callout), so a caller passing both a
  // header bg and a `borderColor` keeps its `borderColor`.
  const effectiveBorderColor = borderColorProp ?? headerBgColor ?? 'var(--color-ink)'

  // Sub-header band (design-spec four-band model): a darker shade of the
  // header tone, sitting flush below the header content row. Optional —
  // populated by `subHeader` content; no band when it is empty.
  const subHeaderBg = accentDeepColor(headerBgColor) ?? 'var(--color-ink)'

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
  const rendersFooter = !isListing && Boolean(footerContent)

  return (
    <div
      className={cn(
        // Flat chrome: no drop shadow and no hover lift — a card is printed on
        // the page, and the 3px frame is its edge. `.su-card` is a class, not a
        // style object, so a caller's `cardStyle.className` can still override it.
        'su-card',
        cardStyle?.className
      )}
      style={{
        // A frame is drawn for a toned card OR one that asked for a border
        // outright; an untoned, unframed card still renders borderless.
        ...(headerBgColor || borderColorProp
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
              className={cn('su-card-head', headerStyleProp?.className)}
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
              the header tone, directly below the header content row, full
              width, flush to the frame. Renders nothing without `subHeader`. */}
          {!!subHeader && (
            <div
              style={{
                ...SUB_HEADER,
                padding: isCompact ? `${space[4]} ${space[10]}` : `${space[6]} ${space[12]}`,
                backgroundColor: subHeaderBg,
              }}
            >
              {subHeader}
            </div>
          )}
        </div>

        {/* Body — hidden in listing mode */}
        {showBody && (
          <div className="su-card-body" style={bodyStyle}>
            {children}
          </div>
        )}

        {/* Footer — hidden in listing mode. */}
        {rendersFooter && (
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
          </div>
        )}
      </div>
    </div>
  )
}
