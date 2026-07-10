import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import { cn } from '../../utils/cn'
import type {
  ReferenceEntityControl,
  ReferenceEntityControlVariant,
} from '../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'

/** Tailwind classes for the primary segment of each variant */
const VARIANT_BG: Record<ReferenceEntityControlVariant, string> = {
  primary: 'bg-su-black',
  danger: 'bg-su-rust',
  ghost: 'bg-su-white',
}

const VARIANT_TEXT: Record<ReferenceEntityControlVariant, string> = {
  primary: 'text-su-white',
  danger: 'text-su-white',
  ghost: 'text-su-black',
}

/** Inverse segment colors (for segmentText) */
const INVERSE_BG: Record<ReferenceEntityControlVariant, string> = {
  primary: 'bg-su-white',
  danger: 'bg-su-white',
  ghost: 'bg-su-black',
}

const INVERSE_TEXT: Record<ReferenceEntityControlVariant, string> = {
  primary: 'text-su-black',
  danger: 'text-su-black',
  ghost: 'text-su-white',
}

type ControlButtonsProps = {
  controls: ReferenceEntityControl[]
  compact?: boolean
  className?: string
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
  const variant = control.variant ?? 'primary'
  const isDisabled = !!control.disabled
  const hasCustomColors = !!(control.bgColor || control.textColor)

  const segmentClasses = cn(
    'px-1 font-mono font-bold uppercase tracking-tight',
    compact ? 'text-[10px]' : 'text-xs'
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
        key={control.key}
        type="button"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-[3px] border-2 transition-colors',
          'min-h-11 min-w-11 sm:min-h-0 sm:min-w-0',
          compact ? 'h-7 w-7' : 'h-8 w-8',
          isDisabled
            ? 'cursor-not-allowed border-su-grey-medium text-su-grey-dark'
            : 'cursor-pointer border-su-black bg-su-white text-su-black hover:bg-su-black hover:text-su-white',
          control.className
        )}
        title={control.ariaLabel}
        aria-label={control.ariaLabel}
        aria-disabled={isDisabled || undefined}
        onClick={isDisabled ? undefined : (e) => onClickWithStop(e, control.onClick)}
      >
        <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </button>
    )
  }

  return (
    <button
      key={control.key}
      type="button"
      className={cn(
        'inline-flex shrink-0 items-stretch whitespace-nowrap border transition-colors',
        isDisabled
          ? 'cursor-not-allowed border-su-grey-medium'
          : 'cursor-pointer hover:brightness-110',
        !isDisabled && !control.borderColor && 'border-su-black',
        control.className
      )}
      style={{
        ...(control.borderColor && !isDisabled ? { borderColor: control.borderColor } : {}),
        lineHeight: 1,
      }}
      title={control.ariaLabel}
      aria-label={control.ariaLabel}
      aria-disabled={isDisabled || undefined}
      onClick={isDisabled ? undefined : (e) => onClickWithStop(e, control.onClick)}
    >
      {/* Primary segment */}
      <span
        className={cn(
          segmentClasses,
          isDisabled
            ? 'bg-su-grey-light text-su-grey-dark'
            : !hasCustomColors && VARIANT_BG[variant],
          !isDisabled && !hasCustomColors && VARIANT_TEXT[variant]
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
            isDisabled ? 'bg-su-grey-medium text-su-grey-dark' : INVERSE_BG[variant],
            !isDisabled && INVERSE_TEXT[variant]
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

export function ControlButtons({ controls, compact = false, className }: ControlButtonsProps) {
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
    <div className={cn('flex gap-1', className)}>
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
