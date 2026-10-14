import { Popover } from '@base-ui/react/popover'
import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react'
import { useState } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'

/**
 * PopoverPanel — a trigger and the small panel it opens beside it: THE Base UI
 * Popover, with the paper-panel chrome by default. Non-modal; Escape, a press
 * outside it or the trigger close it, and focus goes back to the trigger. The
 * trigger gains `aria-expanded` / `aria-controls`; the panel is a
 * `role="dialog"` named by `label`.
 *
 * For a panel of arbitrary controls (ITUN's sheet "⋯" overflow), a stat's
 * provenance ledger (`StatProvenance`) and ITUN's reference search. A list of
 * commands is a `HeaderMenu` (menu semantics, arrow keys).
 */

type PopoverPanelProps = {
  /** The button that opens the panel. */
  trigger: ReactElement
  /** Names the panel. */
  label: string
  /** Mounted only while open. */
  children: ReactNode
  /** Controlled open state (the panel keeps its own otherwise). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Hovering the trigger or the panel opens it too; leaving either closes it. */
  openOnHover?: boolean
  /** Below its trigger (the default) or above it. */
  side?: 'top' | 'bottom'
  /** Flush to the trigger's end edge (the default), or centred on it. */
  align?: 'center' | 'end'
  /** The gap to the trigger, in px. */
  sideOffset?: number
  /** How close, in px, the panel may come to the viewport's edge. */
  collisionPadding?: number
  /**
   * Which stack it sits in: `page` (the default) is over the page and its
   * sticky bars (z-40) and under every dialog (50); `masthead` is the
   * masthead's menus' (60), for a panel hanging off the bar.
   */
  layer?: 'page' | 'masthead'
  /** The panel's own chrome, in place of the paper panel's. */
  panelStyle?: CSSProperties
  /** A pointer on the panel, filled in this colour (the panel's own). */
  arrowColor?: string
  /** Element to focus when the panel opens (defaults to the panel itself). */
  initialFocus?: RefObject<HTMLElement | null>
}

const LAYER = {
  page: { zIndex: 45 },
  masthead: { zIndex: 60 },
} satisfies Record<NonNullable<PopoverPanelProps['layer']>, CSSProperties>

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
  children,
  open,
  onOpenChange,
  openOnHover = false,
  side = 'bottom',
  align = 'end',
  sideOffset = 6,
  collisionPadding,
  layer = 'page',
  panelStyle = PANEL,
  arrowColor,
  initialFocus,
}: PopoverPanelProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const shown = open ?? ownOpen
  const setShown = (next: boolean) => {
    if (open === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }
  // Base UI's Popover has its own hover open, but with a delay and a grace
  // area; the provenance ledger opens the moment the pointer arrives.
  const hover = openOnHover
    ? { onMouseEnter: () => setShown(true), onMouseLeave: () => setShown(false) }
    : {}
  return (
    <Popover.Root open={shown} onOpenChange={setShown}>
      <Popover.Trigger render={trigger} {...hover} />
      <Popover.Portal>
        <Popover.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          style={LAYER[layer]}
        >
          <Popover.Popup
            aria-label={label}
            style={panelStyle}
            initialFocus={initialFocus}
            {...hover}
          >
            {children}
            {arrowColor && <Popover.Arrow style={{ fill: arrowColor }} />}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
