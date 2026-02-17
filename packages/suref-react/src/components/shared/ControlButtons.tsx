import { useCallback } from 'react'
import { cn } from '../../utils/cn'
import type {
  EntityControl,
  EntityControlVariant,
} from '../entity/EntityDisplay/entityControlTypes'

const VARIANT_STYLES: Record<EntityControlVariant, string> = {
  primary: 'bg-su-black text-su-white hover:bg-su-grey-dark',
  danger: 'opacity-60 hover:bg-su-rust/80 hover:opacity-100',
  ghost: 'opacity-60 hover:bg-white/20 hover:opacity-100',
}

const ICON_SIZE: Record<'sm' | 'default', string> = {
  sm: 'h-3.5 w-3.5',
  default: 'h-4.5 w-4.5',
}

type ControlButtonsProps = {
  controls: EntityControl[]
  size?: 'sm' | 'default'
  className?: string
}

export function ControlButtons({ controls, size = 'default', className }: ControlButtonsProps) {
  const handleClick = useCallback((e: React.MouseEvent, onClick: () => void) => {
    e.stopPropagation()
    onClick()
  }, [])

  if (controls.length === 0) return null

  return (
    <div className={cn('flex gap-1', className)}>
      {controls.map((control) => {
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
            onClick={(e) => handleClick(e, control.onClick)}
          >
            <Icon className={ICON_SIZE[size]} />
            {control.label && (
              <span className="font-mono text-xs font-bold uppercase leading-none">
                {control.label}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
