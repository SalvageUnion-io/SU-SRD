import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { cn } from '../../utils/cn'

type TooltipProps = {
  children: React.ReactNode
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delayDuration?: number
}

export function Tooltip({ children, content, side = 'top', delayDuration = 200 }: TooltipProps) {
  return (
    <BaseTooltip.Provider delay={delayDuration} closeDelay={0}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger render={children as React.ReactElement} />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} sideOffset={4}>
            <BaseTooltip.Popup
              className={cn(
                'z-50 max-w-[500px] overflow-hidden rounded-md bg-su-black px-3 py-1.5 text-xs text-su-white shadow-md',
                'animate-in fade-in-0 zoom-in-95'
              )}
            >
              {content}
              <BaseTooltip.Arrow className="fill-su-black" />
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  )
}
