import { Popover } from '@base-ui/react/popover'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'

/**
 * PopoverPanel — a trigger and the small panel it opens beside it: a Base UI
 * Popover with the paper-panel chrome. Non-modal; Escape, a press outside it
 * or the trigger close it, and focus goes back to the trigger. The trigger
 * gains `aria-expanded` / `aria-controls`; the panel is a `role="dialog"`
 * named by `label`.
 *
 * For a panel of arbitrary controls (ITUN's sheet "⋯" overflow). A list of
 * commands is a `HeaderMenu` (menu semantics, arrow keys); the corner search is
 * `Fab`.
 */

type PopoverPanelProps = {
  /** The button that opens the panel. */
  trigger: ReactElement
  /** Names the panel. */
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  /** Mounted only while open. */
  children: ReactNode
}

/** Over the page and its sticky bars (z-40); under every dialog (50) and the
 *  masthead's menus (60). */
const POSITIONER = { zIndex: 45 } satisfies CSSProperties

const PANEL = {
  alignItems: 'stretch',
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.panel,
  borderStyle: 'solid',
  borderWidth: borderWidth.pill,
  boxShadow: `0 14px 28px -14px ${color.ink50}`,
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
  minWidth: '9rem',
  outline: 'none',
  padding: space[8],
} satisfies CSSProperties

export function PopoverPanel({
  trigger,
  label,
  side = 'bottom',
  align = 'end',
  children,
}: PopoverPanelProps) {
  return (
    <Popover.Root>
      <Popover.Trigger render={trigger} />
      <Popover.Portal>
        <Popover.Positioner side={side} align={align} sideOffset={6} style={POSITIONER}>
          <Popover.Popup aria-label={label} style={PANEL}>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
