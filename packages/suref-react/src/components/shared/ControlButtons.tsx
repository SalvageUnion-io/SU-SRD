import type { ReactNode } from 'react'
import { useCallback } from 'react'
import * as HoverCard from '@radix-ui/react-hover-card'
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
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <ControlButton control={control} compact={compact} onClickWithStop={onClickWithStop} />
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="z-50 max-h-[80vh] max-w-[500px] overflow-y-auto border-none bg-transparent p-0 shadow-2xl"
          sideOffset={5}
          align="start"
        >
          {hoverContent}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}

export function ControlButtons({ controls, compact = false, className }: ControlButtonsProps) {
  const handleClick = useCallback((e: React.MouseEvent, onClick: () => void) => {
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
