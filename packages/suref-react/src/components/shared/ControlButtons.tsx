import type { ReactNode } from 'react'
import { useCallback } from 'react'
import * as HoverCard from '@radix-ui/react-hover-card'
import { cn } from '../../utils/cn'
import type {
  ReferenceEntityControl,
  ReferenceEntityControlVariant,
} from '../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'

const VARIANT_STYLES: Record<ReferenceEntityControlVariant, string> = {
  primary: 'bg-su-black text-su-white hover:bg-su-grey-dark',
  danger: 'opacity-60 hover:bg-su-rust/80 hover:opacity-100',
  ghost: 'opacity-60 hover:bg-white/20 hover:opacity-100',
}

const ICON_SIZE: Record<'sm' | 'default', string> = {
  sm: 'h-3.5 w-3.5',
  default: 'h-4.5 w-4.5',
}

type ControlButtonsProps = {
  controls: ReferenceEntityControl[]
  size?: 'sm' | 'default'
  className?: string
}

function ControlButton({
  control,
  size,
  onClickWithStop,
}: {
  control: ReferenceEntityControl
  size: 'sm' | 'default'
  onClickWithStop: (e: React.MouseEvent, onClick: () => void) => void
}) {
  const variant = control.variant ?? 'ghost'
  const Icon = control.icon

  return (
    <button
      key={control.key}
      type="button"
      className={cn(
        'flex min-w-[25px] shrink-0 cursor-pointer items-center justify-center gap-1 self-center rounded border border-su-black p-1 transition-colors',
        VARIANT_STYLES[variant],
        control.className
      )}
      title={control.ariaLabel}
      aria-label={control.ariaLabel}
      onClick={(e) => onClickWithStop(e, control.onClick)}
    >
      <Icon className={ICON_SIZE[size]} />
      {control.label && (
        <span className="font-mono text-xs font-bold uppercase leading-none">{control.label}</span>
      )}
    </button>
  )
}

function ControlButtonWithHover({
  control,
  size,
  onClickWithStop,
  hoverContent,
}: {
  control: ReferenceEntityControl
  size: 'sm' | 'default'
  onClickWithStop: (e: React.MouseEvent, onClick: () => void) => void
  hoverContent: ReactNode
}) {
  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <ControlButton control={control} size={size} onClickWithStop={onClickWithStop} />
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

export function ControlButtons({ controls, size = 'default', className }: ControlButtonsProps) {
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
            size={size}
            onClickWithStop={handleClick}
            hoverContent={control.hoverContent}
          />
        ) : (
          <ControlButton
            key={control.key}
            control={control}
            size={size}
            onClickWithStop={handleClick}
          />
        )
      )}
    </div>
  )
}
