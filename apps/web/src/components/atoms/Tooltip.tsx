import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { isValidElement, useContext } from 'react'
import { color, fontSize, layer, space } from '../../design/tokens'
import { InsidePeekContext } from './insidePeek'
import { INK_POPUP } from './popupSurface'

type TooltipProps = {
  /** The trigger: an element Base UI renders as the trigger; text is wrapped in a `<span>`. */
  children: ReactNode
  content: ReactNode
}

/** The stacking is the positioner's (`popupSurface.ts`), as `PeekPopup`'s is. */
const POSITIONER = { zIndex: layer.overlay } satisfies CSSProperties

/** `text-xs` carries its paired line-height; `shadow-md` is ported as its computed value. */
const POPUP = {
  ...INK_POPUP,
  fontSize: fontSize.chip,
  lineHeight: 'calc(1 / 0.75)',
  maxWidth: '500px',
  overflow: 'hidden',
  paddingBlock: space[6],
} satisfies CSSProperties

export function Tooltip({ children, content }: TooltipProps) {
  // Terminal law: inside a tooltip popup, a nested tooltip renders bare.
  const insidePeek = useContext(InsidePeekContext)
  if (insidePeek) return <>{children}</>
  const trigger: ReactElement = isValidElement(children) ? children : <span>{children}</span>
  return (
    <BaseTooltip.Provider delay={200} closeDelay={0}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger render={trigger} />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side="top" sideOffset={4} style={POSITIONER}>
            <BaseTooltip.Popup style={POPUP}>
              {content}
              <BaseTooltip.Arrow style={{ fill: color.ink }} />
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  )
}
