import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '../../utils/cn'

type TooltipProps = {
  children: React.ReactNode
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delayDuration?: number
}

export function Tooltip({ children, content, side = 'top', delayDuration = 200 }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={4}
            className={cn(
              'z-50 max-w-[500px] overflow-hidden rounded-md bg-su-black px-3 py-1.5 text-xs text-su-white shadow-md',
              'animate-in fade-in-0 zoom-in-95'
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-su-black" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
