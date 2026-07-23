import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
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
  compact?: boolean
}

function ControlButton({
  control,
  compact,
  onClickWithStop,
}: {
  control: ReferenceEntityControl
  compact: boolean
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

  const segmentClasses = cn(
    'px-1 font-cond font-bold uppercase tracking-caps-tight',
    compact ? 'text-label' : 'text-xs'
  )

  // Icon-only control (design-spec `.ctl`): a square 28/32px button with a
  // centred icon and no text — used by the live-sheet per-card remove/swap
  // cluster. Neutral ink chrome (paper fill, ink border, hover inverts) so it
  // reads consistently beside the absolute status badge. `min-h-11`/`min-w-11`
  // holds the 44px coarse-pointer tap target without changing desktop size.
  const Icon = control.icon
  const isIconOnly = !!Icon && !control.label && !control.segmentText
  if (Icon && isIconOnly) {
    return (
      <button
        type="button"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-card border-2 transition-colors',
          'min-h-11 min-w-11 sm:min-h-0 sm:min-w-0',
          compact ? 'h-7 w-7' : 'h-8 w-8',
          isDisabled
            ? 'cursor-not-allowed border-wk-muted text-ink-2'
            : 'cursor-pointer border-ink bg-paper text-ink hover:bg-ink hover:text-paper',
          control.className
        )}
        title={control.title ?? control.ariaLabel}
        aria-label={control.ariaLabel}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        onClick={isDisabled ? undefined : (e) => onClickWithStop(e, onClick)}
      >
        <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
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
          isDisabled ? 'bg-wk-faint text-ink-2' : !hasCustomColors && VARIANT[variant].bg,
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
            isDisabled ? 'bg-wk-muted text-ink-2' : VARIANT[variant].inverseBg,
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
  compact,
  onClickWithStop,
  hoverContent,
}: {
  control: ReferenceEntityControl
  compact: boolean
  onClickWithStop: (e: React.MouseEvent, onClick: () => void) => void
  hoverContent: ReactNode
}) {
  return (
    <Tooltip.Provider delay={200} closeDelay={100}>
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={200}
          closeDelay={100}
          render={
            <ControlButton control={control} compact={compact} onClickWithStop={onClickWithStop} />
          }
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

export function ControlButtons({ controls, compact = false }: ControlButtonsProps) {
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
            compact={compact}
            onClickWithStop={handleClick}
            hoverContent={control.hoverContent}
          />
        ) : (
          <ControlButton
            key={control.key}
            control={control}
            compact={compact}
            onClickWithStop={handleClick}
          />
        )
      )}
    </div>
  )
}
