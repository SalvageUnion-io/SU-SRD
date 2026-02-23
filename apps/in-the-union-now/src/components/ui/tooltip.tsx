import * as React from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'

import { cn } from '../../lib/utils'

type TooltipProviderProps = {
  delayDuration?: number
  children: React.ReactNode
}

function TooltipProvider({ delayDuration, children }: TooltipProviderProps) {
  return (
    <BaseTooltip.Provider delay={delayDuration} closeDelay={0}>
      {children}
    </BaseTooltip.Provider>
  )
}

const Tooltip = BaseTooltip.Root

type TooltipTriggerProps = {
  asChild?: boolean
  children: React.ReactNode
} & React.ComponentProps<typeof BaseTooltip.Trigger>

function TooltipTrigger({ asChild, children, ...props }: TooltipTriggerProps) {
  if (asChild) {
    return <BaseTooltip.Trigger render={children as React.ReactElement} {...props} />
  }
  return <BaseTooltip.Trigger {...props}>{children}</BaseTooltip.Trigger>
}

type TooltipContentProps = {
  className?: string
  sideOffset?: number
  side?: 'top' | 'right' | 'bottom' | 'left'
  children?: React.ReactNode
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, sideOffset = 4, side, children, ...props }, ref) => (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={side} sideOffset={sideOffset}>
        <BaseTooltip.Popup
          ref={ref}
          className={cn(
            'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            className
          )}
          {...props}
        >
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
)
TooltipContent.displayName = 'TooltipContent'

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
