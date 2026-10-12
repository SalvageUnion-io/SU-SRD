import type { CSSProperties } from 'react'
import { useCallback } from 'react'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import { RUNG_INLINE_PADDING, RUNG_TYPE } from '../../styles/sizing'
import { cn } from '../../utils/cn'
import { Badge } from '../chrome/Badge'
import { CountStepper } from '../chrome/CountStepper'
import { StatusBadge } from '../chrome/StatusBadge'
import type {
  ReferenceEntityControl,
  ReferenceEntityControlVariant,
} from '../referenceEntity/referenceEntityControlTypes'

/**
 * Per-variant segment colours: `bg`/`text` fill the primary segment, and
 * `inverseBg`/`inverseText` the secondary `segmentText` segment (like the
 * ValueDisplay value). `danger` fills with `--color-status-bad` — the
 * sanctioned destructive/state red, NOT the adversary ontology hue.
 */
const VARIANT: Record<
  ReferenceEntityControlVariant,
  { bg: string; text: string; inverseBg: string; inverseText: string }
> = {
  primary: { bg: color.ink, text: color.paper, inverseBg: color.paper, inverseText: color.ink },
  danger: {
    bg: color.statusBad,
    text: color.paper,
    inverseBg: color.paper,
    inverseText: color.ink,
  },
  ghost: { bg: color.paper, text: color.ink, inverseBg: color.ink, inverseText: color.paper },
}

/** The colour transition: the colour properties over 150ms, standard easing. */
const TRANSITION_COLORS = {
  transitionDuration: '150ms',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
} satisfies CSSProperties

// The navigation link. Its fill and ink flip on hover, so those two live on
// `.su-control-link` (resting value included); everything else is static.
const LINK = {
  ...TRANSITION_COLORS,
  alignItems: 'center',
  border: `${borderWidth.hairline} solid ${color.ink}`,
  borderRadius: radius.card,
  display: 'inline-flex',
  flexShrink: 0,
  fontFamily: font.cond,
  fontSize: fontSize.xs,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: '1rem',
  padding: `${space[4]} ${space[8]}`,
  textDecoration: 'none',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const ICON_BUTTON = {
  ...TRANSITION_COLORS,
  alignItems: 'center',
  borderStyle: 'solid',
  borderWidth: borderWidth.pill,
  display: 'inline-flex',
  flexShrink: 0,
  justifyContent: 'center',
} satisfies CSSProperties

const TEXT_BUTTON = {
  ...TRANSITION_COLORS,
  alignItems: 'stretch',
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  display: 'inline-flex',
  flexShrink: 0,
  lineHeight: 1,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

// One label segment of a worded control. Padding and type size are the `mini`
// rung's own class strings (below), so they stay classes.
const SEGMENT = {
  alignItems: 'center',
  display: 'flex',
  fontFamily: font.cond,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1,
  textTransform: 'uppercase',
} satisfies CSSProperties

const ROW = { display: 'flex', gap: space[4] } satisfies CSSProperties

type ControlButtonsProps = {
  controls: ReferenceEntityControl[]
}

function ControlButton({
  control,
  onClickWithStop,
}: {
  control: ReferenceEntityControl
  onClickWithStop: (e: React.MouseEvent, onClick: () => void) => void
}) {
  // Typed item variants — render a primitive instead of an action button.
  // Precedence: stepper → badge → status → link → button.
  if (control.stepper) {
    return <CountStepper {...control.stepper} />
  }
  if (control.badge !== undefined) {
    return (
      <Badge shape="stamp" size="mini">
        {control.badge}
      </Badge>
    )
  }
  if (control.status) {
    return (
      <StatusBadge
        status={control.status.value}
        onClick={control.status.onClick}
        subject={control.status.subject}
      />
    )
  }
  if (control.href !== undefined) {
    return (
      <a
        href={control.href}
        aria-label={control.ariaLabel}
        className="su-control-link"
        style={LINK}
      >
        {control.label ?? control.ariaLabel}
      </a>
    )
  }
  const variant = control.variant ?? 'primary'
  const isDisabled = !!control.disabled
  const hasCustomColors = !!(control.bgColor || control.textColor)
  const onClick = control.onClick ?? (() => undefined)

  // Every rail control is stamp-sized: the rail sits beside the card's seam
  // stamp, and one row should carry one height. These are the `mini` stamp's
  // own metrics — the same
  // constants `Badge shape="stamp" size="mini"` resolves — so the row and the
  // seam agree by construction rather than by matching numbers by eye.
  const segmentClasses = cn(RUNG_INLINE_PADDING.mini, RUNG_TYPE.mini.label)

  // Icon-only control (design-spec `.ctl`) — the live-sheet per-card
  // remove/swap/fold cluster. It is a STAMP like every other control in the
  // rail: same padding, same height, the glyph sized to the label line it
  // replaces, so an icon button and a worded one are interchangeable in the
  // row.
  //
  // It carries NO tap-target floor of its own. It used to:
  // `min-h-11 min-w-11 sm:min-h-0 sm:min-w-0`, which was a WIDTH-keyed
  // duplicate of the POINTER-keyed floor `theme.css` already applies to every
  // `button` under `@media (pointer: coarse)`. Two consequences, and the second
  // is the bug:
  //
  //  - Where there IS a touch pointer, the utility was redundant. That rule is
  //    unlayered, so it beats every layered rule — the 44px box survives with
  //    or without this class,
  //    at every viewport width.
  //  - Where there is NOT — a narrow desktop window, a responsive-mode preview,
  //    a small laptop — the utility applied a touch floor to a mouse. That is
  //    the one case the pointer rule deliberately skips, and the only case this
  //    class could actually change.
  //
  // So all it ever did was distort the geometry for pointers that never needed
  // it. This button renders inside `CardControlRail`, an ABSOLUTE row centred
  // on a card's top frame line, so a 44px box grew the rail with it: measured
  // at 390px, rail 22px → 44px and button 24×20 → 44×44, which hung 22px down
  // into the header band over the TL/SV stat cells the rail is z-30 above, and
  // put a 44px square beside a 22px status badge in a row whose whole premise
  // is that every cell is the same stamp height.
  //
  // Measure this with touch emulation, not just a narrow viewport — the two
  // disagree here, and a fine-pointer run alone will tell you a coarse-pointer
  // change worked when it did nothing.
  //
  // A `danger` icon (the ✕ remove) is a RED stamp — filled, not outlined —
  // because it is the one control in the rail that destroys something, and as
  // neutral paper chrome it read like the fold chevron beside it.
  const Icon = control.icon
  const isIconOnly = !!Icon && !control.label && !control.segmentText
  if (Icon && isIconOnly) {
    const danger = variant === 'danger'
    return (
      <button
        type="button"
        className={cn(
          RUNG_INLINE_PADDING.mini,
          RUNG_TYPE.mini.label,
          // Only what changes on hover is a class: the paper stamp's fill and
          // ink flip, the red stamp brightens.
          !isDisabled && (danger ? 'su-control-button--live' : 'su-control-icon--plain'),
          control.className
        )}
        style={{
          ...ICON_BUTTON,
          ...(isDisabled
            ? { borderColor: color.wkMuted, color: color.wkMuted, cursor: 'not-allowed' }
            : danger
              ? {
                  backgroundColor: color.statusBad,
                  borderColor: color.statusBad,
                  color: color.paper,
                  cursor: 'pointer',
                }
              : { borderColor: color.ink, cursor: 'pointer' }),
        }}
        title={control.title ?? control.ariaLabel}
        aria-label={control.ariaLabel}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        onClick={isDisabled ? undefined : (e) => onClickWithStop(e, onClick)}
      >
        {/* A class, not a style object: the `icon` contract takes only `className`. */}
        <Icon className="su-control-icon__glyph" />
      </button>
    )
  }

  return (
    <button
      type="button"
      className={cn(!isDisabled && 'su-control-button--live', control.className)}
      style={{
        ...TEXT_BUTTON,
        borderColor: isDisabled ? color.wkMuted : (control.borderColor ?? color.ink),
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
      title={control.title ?? control.ariaLabel}
      aria-label={control.ariaLabel}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      onClick={isDisabled ? undefined : (e) => onClickWithStop(e, onClick)}
    >
      {/* Primary segment */}
      <span
        className={segmentClasses}
        style={{
          ...SEGMENT,
          ...(isDisabled
            ? { backgroundColor: color.wkFaint, color: color.wkMuted }
            : hasCustomColors
              ? {
                  ...(control.bgColor ? { backgroundColor: control.bgColor } : {}),
                  ...(control.textColor ? { color: control.textColor } : {}),
                }
              : { backgroundColor: VARIANT[variant].bg, color: VARIANT[variant].text }),
        }}
      >
        {control.label ?? control.ariaLabel}
      </span>
      {/* Secondary segment (inverse style, like ValueDisplay value) */}
      {control.segmentText && (
        <span
          className={segmentClasses}
          style={{
            ...SEGMENT,
            ...(isDisabled
              ? { backgroundColor: color.wkMuted, color: color.wkMuted }
              : {
                  backgroundColor: VARIANT[variant].inverseBg,
                  color: VARIANT[variant].inverseText,
                }),
          }}
        >
          {control.segmentText}
        </span>
      )}
    </button>
  )
}

export function ControlButtons({ controls }: ControlButtonsProps) {
  const handleClick = useCallback((e: React.MouseEvent, onClick: () => void) => {
    // preventDefault so a control nested inside a wrapping navigation <a> (e.g.
    // the schema list cards) doesn't also trigger that anchor's navigation; a
    // no-op for the standalone case. stopPropagation keeps it off onCardClick.
    e.preventDefault()
    e.stopPropagation()
    onClick()
  }, [])

  const visibleControls = controls.filter((c) => !c.hidden)

  if (visibleControls.length === 0) return null

  return (
    <div style={ROW}>
      {visibleControls.map((control) => (
        <ControlButton key={control.key} control={control} onClickWithStop={handleClick} />
      ))}
    </div>
  )
}
