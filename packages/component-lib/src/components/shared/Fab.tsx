import { X } from 'lucide-react'
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'
import { useEffect, useId, useLayoutEffect, useRef } from 'react'
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
 * holds (ITUN's reference search, `GlobalSearch.tsx`). What it owns is the
 * part every expanding corner control needs and nobody gets right twice:
 *
 * - **ARIA.** The button carries `aria-expanded` and, while open,
 *   `aria-controls` naming the panel; the panel is a non-modal
 *   `role="dialog"` named by the same `label`.
 * - **Dismissal.** Escape (inside the panel or on the button) and a pointer
 *   press anywhere outside both collapse it.
 * - **Focus.** Opening focuses `initialFocus`. Collapsing puts focus back on
 *   the button — except after an outside press that landed on something
 *   focusable, which keeps the focus it was given rather than having it
 *   yanked back to the corner.
 * - **Safe areas.** The corner offset adds `env(safe-area-inset-*)`, so the
 *   button clears a home indicator or a notch where the page extends under
 *   one.
 * - **`hidden`.** A route whose own bottom-right corner holds controls (the
 *   Dashboard's display, the wizard footer) can hide the collapsed button. The
 *   panel still opens — from a keyboard shortcut — and focus then returns to
 *   wherever it was before, since there is no button to return to.
 *
 * The expand is a short fade-and-rise in `.su-fab-panel`, switched off under
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

const ROOT = {
  alignItems: 'flex-end',
  bottom: `calc(${EDGE} + env(safe-area-inset-bottom, 0px))`,
  display: 'flex',
  gap: space[8],
  position: 'fixed',
  right: `calc(${EDGE} + env(safe-area-inset-right, 0px))`,
  // Over the page and its sticky bars (z-40); under the masthead's menus (60),
  // every Base UI dialog (50, portalled later in the document) and toasts.
  zIndex: 45,
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

/** How focus should come back when the panel collapses. */
type Restore = 'button' | 'unless-moved'

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
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Where focus was before opening — the way back when there is no button.
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const restoreRef = useRef<Restore>('button')
  const wasOpenRef = useRef(open)

  const collapse = (restore: Restore) => {
    restoreRef.current = restore
    onOpenChange(false)
  }

  // Open: remember where focus came from, then move it into the panel.
  // Collapse: put it back. A layout effect, so the focus lands before paint.
  useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current
    wasOpenRef.current = open
    if (open && !wasOpen) {
      const active = document.activeElement
      returnFocusRef.current =
        active instanceof HTMLElement && !rootRef.current?.contains(active) ? active : null
      restoreRef.current = 'button'
      initialFocus?.current?.focus()
      return
    }
    if (!open && wasOpen) {
      const target = () => (hidden ? returnFocusRef.current : buttonRef.current)
      if (restoreRef.current === 'button') {
        target()?.focus()
        return
      }
      // After an outside press, the press itself decides where focus goes
      // (its mousedown runs after this). Only reclaim it if it landed nowhere.
      const timer = setTimeout(() => {
        const active = document.activeElement
        if (active === null || active === document.body) target()?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [open, hidden, initialFocus])

  // An outside press collapses it. Listened for on the document only while
  // open, and on pointerdown so it beats the click that follows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `collapse` closes over `onOpenChange` only, which is in the list
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target)) return
      collapse('unless-moved')
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, onOpenChange])

  const onKeyDown = (e: KeyboardEvent) => {
    if (open && e.key === 'Escape') {
      e.stopPropagation()
      collapse('button')
    }
  }

  if (hidden && !open) return null

  return (
    <div ref={rootRef} style={ROOT}>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className="su-fab-panel"
          style={PANEL}
          onKeyDown={onKeyDown}
        >
          {children}
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? `Close: ${label}` : label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-keyshortcuts={keyShortcuts}
        className={`su-fab ${FOCUS_RING}`}
        style={BUTTON}
        onClick={() => (open ? collapse('button') : onOpenChange(true))}
        onKeyDown={onKeyDown}
      >
        {open ? <X size={22} aria-hidden="true" /> : icon}
      </button>
    </div>
  )
}
