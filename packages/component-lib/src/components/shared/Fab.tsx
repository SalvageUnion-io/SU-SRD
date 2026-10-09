import { Popover } from '@base-ui/react/popover'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useRef } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { FOCUS_RING } from '../chrome/interaction'

/**
 * Fab — a floating action button pinned to the bottom-right corner that
 * expands into a panel anchored beside it.
 *
 * The panel opens to the LEFT of the button with their bottom edges aligned,
 * so it reads as the button growing into a box; whatever the panel holds
 * stacks upward from that bottom edge. While open the button turns into the
 * panel's close (✕).
 *
 * Controlled and content-agnostic: the caller owns `open` and what the panel
 * holds (ITUN's reference search, `GlobalSearch.tsx`). It is a Base UI
 * Popover, which owns what every expanding corner control needs:
 *
 * - **ARIA.** The button carries `aria-expanded` and, while open,
 *   `aria-controls` naming the panel; the panel is a non-modal
 *   `role="dialog"` named by the same `label`.
 * - **Dismissal.** Escape and a pointer press anywhere outside both collapse
 *   it.
 * - **Focus.** Opening focuses `initialFocus`. Collapsing puts focus back on
 *   the button — except after an outside press that landed on something
 *   focusable, which keeps the focus it was given.
 * - **`hidden`.** A route whose own bottom-right corner holds controls (the
 *   Dashboard's display, the wizard footer) can hide the collapsed button. The
 *   panel still opens — from a keyboard shortcut — anchored to the same corner,
 *   and focus then returns to wherever it was before.
 *
 * The corner offset adds `env(safe-area-inset-*)`, so the button clears a home
 * indicator or a notch where the page extends under one. The expand is a short
 * fade-and-rise in `.su-fab-panel`, switched off under
 * `prefers-reduced-motion`. Colour that changes on hover lives in `.su-fab`;
 * all static geometry is style objects.
 */

type FabProps = {
  /** Names the button and the panel (e.g. "Search the rules"). */
  label: string
  /** The collapsed button's glyph. */
  icon: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The panel's contents. Mounted only while open. */
  children: ReactNode
  /** Hide the collapsed button; the panel can still be opened by the caller. */
  hidden?: boolean
  /** Focused when the panel opens. */
  initialFocus?: RefObject<HTMLElement | null>
  /** `aria-keyshortcuts` for the button, when the caller binds one. */
  keyShortcuts?: string
}

/** The corner offset, plus whatever the device reserves at that edge. */
const EDGE = space[16]

/** Over the page and its sticky bars (z-40); under the masthead's menus (60),
 *  every Base UI dialog (50) and toasts. */
const Z = 45

/** The corner the button sits in, and the panel's anchor — even with the
 *  button hidden. */
const CORNER = {
  bottom: `calc(${EDGE} + env(safe-area-inset-bottom, 0px))`,
  display: 'flex',
  position: 'fixed',
  right: `calc(${EDGE} + env(safe-area-inset-right, 0px))`,
  zIndex: Z,
} satisfies CSSProperties

const BUTTON_SIZE = '56px'

const BUTTON = {
  alignItems: 'center',
  borderColor: color.paper30,
  borderRadius: radius.full,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  boxShadow: `0 6px 18px ${color.ink30}`,
  cursor: 'pointer',
  display: 'inline-flex',
  flexShrink: 0,
  height: BUTTON_SIZE,
  justifyContent: 'center',
  padding: 0,
  width: BUTTON_SIZE,
} satisfies CSSProperties

const POSITIONER = { zIndex: Z } satisfies CSSProperties

const PANEL = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.panel,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  boxShadow: `0 14px 28px ${color.ink30}`,
  boxSizing: 'border-box',
  color: color.ink,
  // The viewport less both gutters and the button beside it.
  maxWidth: `calc(100vw - 2 * ${EDGE} - ${BUTTON_SIZE} - ${space[8]})`,
  transformOrigin: 'bottom right',
  width: '28rem',
} satisfies CSSProperties

/** The gap between the button and the panel. */
const GAP = 8

export function Fab({
  label,
  icon,
  open,
  onOpenChange,
  children,
  hidden = false,
  initialFocus,
  keyShortcuts,
}: FabProps) {
  const cornerRef = useRef<HTMLDivElement>(null)

  return (
    <Popover.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <div ref={cornerRef} style={CORNER}>
        {!hidden && (
          <Popover.Trigger
            render={
              <button
                type="button"
                aria-label={open ? `Close: ${label}` : label}
                aria-keyshortcuts={keyShortcuts}
                className={`su-fab ${FOCUS_RING}`}
                style={BUTTON}
              >
                {open ? <X size={22} aria-hidden="true" /> : icon}
              </button>
            }
          />
        )}
      </div>
      <Popover.Portal>
        <Popover.Positioner
          anchor={cornerRef}
          side="left"
          align="end"
          sideOffset={hidden ? 0 : GAP}
          positionMethod="fixed"
          style={POSITIONER}
        >
          <Popover.Popup
            aria-label={label}
            className="su-fab-panel"
            style={PANEL}
            initialFocus={initialFocus}
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
