import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { CSSProperties } from 'react'
import { useContext } from 'react'
import { color, fontSize, space } from '../../design/tokens'
import { InsidePeekContext } from '../../entity/peekContext'
import { INK_POPUP } from './inkPopup'

type TooltipProps = {
  children: React.ReactNode
  content: React.ReactNode
}

/** `text-xs` carries its paired line-height; `shadow-md` is ported as its computed value. */
const POPUP = {
  ...INK_POPUP,
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
  maxWidth: '500px',
  overflow: 'hidden',
  paddingBlock: space[6],
} satisfies CSSProperties

export function Tooltip({ children, content }: TooltipProps) {
  // Terminal law: inside a tooltip popup, a nested tooltip renders bare.
  const insidePeek = useContext(InsidePeekContext)
  if (insidePeek) return <>{children}</>
  return (
    <BaseTooltip.Provider delay={200} closeDelay={0}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger render={children as React.ReactElement} />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side="top" sideOffset={4}>
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
