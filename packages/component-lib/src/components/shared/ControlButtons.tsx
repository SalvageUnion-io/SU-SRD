import { Tooltip } from '@base-ui/react/tooltip'
import type { ReactNode } from 'react'
import { useCallback } from 'react'
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
  primary: { bg: 'bg-ink', text: 'text-paper', inverseBg: 'bg-paper', inverseText: 'text-ink' },
  danger: {
    bg: 'bg-status-bad',
    text: 'text-paper',
    inverseBg: 'bg-paper',
    inverseText: 'text-ink',
  },
  ghost: { bg: 'bg-paper', text: 'text-ink', inverseBg: 'bg-ink', inverseText: 'text-paper' },
}

type ControlButtonsProps = {
  controls: ReferenceEntityControl[]
  /**
   * Retained for the caller contract. It no longer changes control SIZE — every
   * control renders at the seam stamp's `mini` rung so a rail never mixes
   * heights — and nothing else in this component reads density.
   */
  compact?: boolean
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
        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-card border border-ink bg-paper px-2 py-1 font-cond text-xs font-bold uppercase tracking-caps-tight text-ink no-underline transition-colors hover:bg-ink hover:text-paper"
      >
        {control.label ?? control.ariaLabel}
      </a>
    )
  }
  const variant = control.variant ?? 'primary'
  const isDisabled = !!control.disabled
  const hasCustomColors = !!(control.bgColor || control.textColor)
  const onClick = control.onClick ?? (() => {})

  // Every rail control is stamp-sized. The rail sits beside the card's seam
  // stamp, and the buttons used to run a rung larger than it (and the icon-only
  // ones larger again, as fixed 28/32px squares), so one row carried three
  // different heights. These are the `mini` stamp's own metrics — the same
  // constants `Badge shape="stamp" size="mini"` resolves — so the row and the
  // seam agree by construction rather than by matching numbers by eye.
  const segmentClasses = cn(
    'flex items-center font-cond font-bold uppercase tracking-caps-tight',
    RUNG_INLINE_PADDING.mini,
    RUNG_TYPE.mini.label
  )

  // Icon-only control (design-spec `.ctl`) — the live-sheet per-card
  // remove/swap/fold cluster. It is a STAMP like every other control in the
  // rail: same padding, same height, the glyph sized to the label line it
  // replaces, so an icon button and a worded one are interchangeable in the
  // row.
  //
  // The coarse-pointer tap target is an invisible ::before, NOT a bigger box.
  // This used to be `min-h-11 min-w-11 sm:min-h-0 sm:min-w-0` — the repo-wide
  // 44px touch floor, which is correct everywhere it sits in normal flow
  // (SmallButtons, the Stat steppers, Field). Here it is not: this button
  // renders inside `CardControlRail`, an ABSOLUTE row centred on the card's top
  // frame line, so growing the box grows the rail with it. Measured at 390px
  // the rail went 22px → 44px tall and the button 24×20 → 44×44, which (a) hung
  // 22px down into the header band, covering the TL/SV stat cells the rail is
  // z-30 over, and (b) put a 44px square next to a 22px status badge in a row
  // whose whole premise is that every cell is the same stamp height.
  // Expanding the HIT AREA instead keeps the rail one uniform stamp row at
  // every width while still giving a finger 44px of vertical reach.
  //
  // The pseudo-element is deliberately NOT 44px wide: siblings in this row are
  // only 4px away (`flex gap-1`) and the rail's other groups 6px
  // (`gap-1.5`), so a 44px-wide invisible box would swallow taps meant for the
  // status badge beside it. `w-7` (28px on a 24px button) leaves 2px of
  // clearance and still clears the 24×24 floor in WCAG 2.2 §2.5.8, which
  // measures the target, not the ink.
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
          'relative inline-flex shrink-0 items-center justify-center border-2 transition-colors',
          "before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-7 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] sm:before:hidden",
          RUNG_INLINE_PADDING.mini,
          RUNG_TYPE.mini.label,
          isDisabled
            ? 'cursor-not-allowed border-wk-muted text-wk-muted'
            : danger
              ? 'cursor-pointer border-status-bad bg-status-bad text-paper hover:brightness-110'
              : 'cursor-pointer border-ink bg-paper text-ink hover:bg-ink hover:text-paper',
          control.className
        )}
        title={control.title ?? control.ariaLabel}
        aria-label={control.ariaLabel}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        onClick={isDisabled ? undefined : (e) => onClickWithStop(e, onClick)}
      >
        <Icon className="h-3 w-3" />
      </button>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-stretch whitespace-nowrap border transition-colors',
        isDisabled ? 'cursor-not-allowed border-wk-muted' : 'cursor-pointer hover:brightness-110',
        !isDisabled && !control.borderColor && 'border-ink',
        control.className
      )}
      style={{
        ...(control.borderColor && !isDisabled ? { borderColor: control.borderColor } : {}),
        lineHeight: 1,
      }}
      title={control.title ?? control.ariaLabel}
      aria-label={control.ariaLabel}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      onClick={isDisabled ? undefined : (e) => onClickWithStop(e, onClick)}
    >
      {/* Primary segment */}
      <span
        className={cn(
          segmentClasses,
          isDisabled ? 'bg-wk-faint text-wk-muted' : !hasCustomColors && VARIANT[variant].bg,
          !isDisabled && !hasCustomColors && VARIANT[variant].text
        )}
        style={{
          lineHeight: 1,
          ...(!isDisabled && control.bgColor ? { backgroundColor: control.bgColor } : {}),
          ...(!isDisabled && control.textColor ? { color: control.textColor } : {}),
        }}
      >
        {control.label ?? control.ariaLabel}
      </span>
      {/* Secondary segment (inverse style, like ValueDisplay value) */}
      {control.segmentText && (
        <span
          className={cn(
            segmentClasses,
            isDisabled ? 'bg-wk-muted text-wk-muted' : VARIANT[variant].inverseBg,
            !isDisabled && VARIANT[variant].inverseText
          )}
          style={{ lineHeight: 1 }}
        >
          {control.segmentText}
        </span>
      )}
    </button>
  )
}

function ControlButtonWithHover({
  control,
  onClickWithStop,
  hoverContent,
}: {
  control: ReferenceEntityControl
  onClickWithStop: (e: React.MouseEvent, onClick: () => void) => void
  hoverContent: ReactNode
}) {
  return (
    <Tooltip.Provider delay={200} closeDelay={100}>
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={200}
          closeDelay={100}
          render={<ControlButton control={control} onClickWithStop={onClickWithStop} />}
        />
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={5} align="start">
            <Tooltip.Popup className="z-50 max-h-[80vh] max-w-[500px] overflow-y-auto border-none bg-transparent p-0 shadow-2xl">
              {hoverContent}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
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
    <div className="flex gap-1">
      {visibleControls.map((control) =>
        control.hoverContent ? (
          <ControlButtonWithHover
            key={control.key}
            control={control}
            onClickWithStop={handleClick}
            hoverContent={control.hoverContent}
          />
        ) : (
          <ControlButton key={control.key} control={control} onClickWithStop={handleClick} />
        )
      )}
    </div>
  )
}
