import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import { useEntitySurface } from '../../entity/entitySurfaceContext'
import { Head } from '../../entity/parts/Head'
import { paintFor } from '../../entity/parts/paint'
import { cn } from '../../utils/cn'
import { buttonVariants } from '../atoms/buttonVariants'

type ModalShellProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  /**
   * sr-only accessibility description (defaults to the title).
   *
   * `null` means the children render a VISIBLE `Dialog.Description` of their
   * own, so the popup is described by the text the reader actually sees rather
   * than by a hidden restatement of it — `ConfirmDialog`'s body does this.
   */
  description?: string | null
  /**
   * The (bare) children render a VISIBLE `Dialog.Title` of their own, so the
   * popup is named by the heading the reader sees rather than by a hidden
   * restatement of it; `title` is then not rendered. The detail dialog's
   * band does this (`EntityDetailDialog`), as `ConfirmDialog` does with
   * `description={null}`.
   */
  ownTitle?: boolean
  /**
   * `'alertdialog'` renders Base UI's AlertDialog instead of Dialog:
   * `role="alertdialog"`, and a backdrop click does NOT dismiss it (Escape and
   * the × still do), because a confirm has to be answered rather than clicked
   * past. Reach for it through `ConfirmDialog`, not directly.
   */
  role?: 'dialog' | 'alertdialog'
  /**
   * Band tone (ruleset §6): 'action' (pilot, the default) for constructive
   * flows, 'danger' (adversary rust) for destructive confirms.
   */
  tone?: 'action' | 'danger'
  /**
   * A max-width class on the popup (e.g. `max-w-lg`). Omitted, the popup is
   * 48rem wide at most, or 28rem for an `alertdialog` — the narrow width every
   * confirm in the apps had already chosen by hand.
   */
  maxWidth?: string
  align?: 'center' | 'top'
  /** Element to focus when the dialog opens (defaults to base-ui's first
   *  tabbable — the header close button). Pass a ref for input-first dialogs
   *  like search. */
  initialFocus?: RefObject<HTMLElement | null>
  /**
   * Chromeless: skip the cut-out frame and its head and render `children` as the
   * entire modal body inside a NON-scrolling, fit-height popup. The child owns
   * its own frame + header + close control + any internal scroll (e.g. the
   * floating EntitySearcher). `title` is still used for the sr-only a11y label.
   */
  bare?: boolean
  /**
   * Portal into this element instead of the document body. The scrim and the
   * popup then cover the container rather than the viewport (it must be a
   * positioned box), and focus is trapped without locking page scroll —
   * the Dashboard's overlays, which open over one region of a scaled canvas
   * and need its `.su-dash-root` styling.
   */
  container?: RefObject<HTMLElement | null>
  /** Element to focus when the dialog closes (defaults to base-ui's: the
   *  trigger, or whatever held focus before it opened). */
  finalFocus?: RefObject<HTMLElement | null>
  /**
   * Fill the whole viewport, edge to edge, and scroll inside it: the
   * Dashboard's phone menu and its panels (ADR-045), which are screens rather
   * than boxes over one. Ignores `maxWidth` and `align`; pair it with `bare`,
   * so the child draws its own header and close control.
   */
  fullscreen?: boolean
  children?: ReactNode
}

/** A contained modal fills its container: the scrim behind, the popup over it. */
const CONTAINED_BACKDROP = { position: 'absolute' } satisfies CSSProperties
const CONTAINED_POPUP = {
  position: 'absolute',
  inset: 0,
  zIndex: 50,
  outline: 'none',
} satisfies CSSProperties

/** The default popup: a fit-height box centred over the scrim. */
const POPUP = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  height: 'fit-content',
  maxHeight: 'calc(100vh - 4rem)',
  width: '100%',
  backgroundColor: 'transparent',
  outline: 'none',
} satisfies CSSProperties

/**
 * The subtitle: a line of the paper under the cut-out, in the head's
 * condensed caps, muted, before the body (it says what the dialog acts on).
 */
const SUBTITLE = {
  margin: 0,
  padding: `${space[10]} ${space[20]} 0`,
  fontFamily: font.cond,
  fontSize: fontSize.xs,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.2,
  textTransform: 'uppercase',
  color: color.wkMuted,
} satisfies CSSProperties

const CLOSE_ICON = { width: space[20], height: space[20] } satisfies CSSProperties

/** A full-screen popup covers the viewport and scrolls inside itself. */
const FULLSCREEN_POPUP = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  overflowY: 'auto',
  outline: 'none',
} satisfies CSSProperties

export function ModalShell({
  open,
  onOpenChange,
  title,
  subtitle,
  description,
  ownTitle = false,
  role = 'dialog',
  tone,
  maxWidth,
  align = 'center',
  initialFocus,
  bare = false,
  container,
  finalFocus,
  fullscreen = false,
  children,
}: ModalShellProps) {
  // `tone` is the whole API: a union, never a raw class string compared by
  // value, so a token rename cannot silently change the behaviour.
  const surface = useEntitySurface()
  const paint = paintFor(tone === 'danger' ? 'status-bad' : 'pilot', {
    texture: surface.texture,
  })

  // Bare mode: a fit-height, non-scrolling popup — the child owns its frame and
  // any internal scroll. Default: a scrolling popup wrapping the Card.
  const popupStyle = {
    ...POPUP,
    ...(bare ? { overflow: 'hidden' } : { overflowY: 'auto' }),
    // A caller's `maxWidth` class sets the cap; inline, the default would beat it.
    ...(maxWidth ? {} : { maxWidth: role === 'alertdialog' ? '28rem' : '48rem' }),
    margin: align === 'center' ? 'auto' : `${space[32]} auto auto`,
  } satisfies CSSProperties

  // An Escape something inside the dialog already handled (an inline edit
  // cancelling, the Dashboard Major's own Take Damage prompt closing) is not a
  // dismissal of the dialog around it.
  const onRootOpenChange = (
    next: boolean,
    details: { reason: string; event: Event; cancel: () => void }
  ) => {
    if (!next && details.reason === 'escape-key' && details.event.defaultPrevented) {
      details.cancel()
      return
    }
    onOpenChange(next)
  }

  const portal = (
    <Dialog.Portal container={container}>
      <Dialog.Backdrop className="su-backdrop" style={container ? CONTAINED_BACKDROP : undefined} />
      <Dialog.Popup
        initialFocus={initialFocus}
        finalFocus={finalFocus}
        className={container || fullscreen ? undefined : maxWidth}
        style={container ? CONTAINED_POPUP : fullscreen ? FULLSCREEN_POPUP : popupStyle}
      >
        {!ownTitle && <Dialog.Title className="su-sr-only">{title}</Dialog.Title>}
        {description !== null && (
          <Dialog.Description className="su-sr-only">{description ?? title}</Dialog.Description>
        )}

        {bare ? (
          children
        ) : (
          // The cut-out head every entity card and Row wears (ruleset,
          // "Chapter band"): the band in the dialog's tone, the title on a
          // square paper tab notched into its foot, the × on the band.
          <div className="su-entity-row su-modal-panel">
            <div className="su-entity-row__frame">
              <div className="su-entity-row__main">
                <Head
                  title={title}
                  paint={paint}
                  notch
                  controls={
                    <Dialog.Close
                      className={cn(
                        buttonVariants({ variant: 'quiet', size: 'iconOnly' }),
                        'su-modal-close'
                      )}
                      data-on-paper={paint.color === 'var(--color-paper)' || undefined}
                    >
                      <X style={CLOSE_ICON} />
                      <span className="su-sr-only">Close</span>
                    </Dialog.Close>
                  }
                />
                <div className="su-card-body">
                  {subtitle && <p style={SUBTITLE}>{subtitle}</p>}
                  {children}
                </div>
              </div>
            </div>
          </div>
        )}
      </Dialog.Popup>
    </Dialog.Portal>
  )

  // The two roots share every part above — AlertDialog re-exports Dialog's
  // Portal/Popup/Title/Description/Close — so only the root differs.
  // AlertDialog is always modal; a contained Dialog covers one region of the
  // page, so it traps focus without locking the page's scroll.
  return role === 'alertdialog' ? (
    <AlertDialog.Root open={open} onOpenChange={onRootOpenChange}>
      {portal}
    </AlertDialog.Root>
  ) : (
    <Dialog.Root
      open={open}
      modal={container ? 'trap-focus' : true}
      onOpenChange={onRootOpenChange}
    >
      {portal}
    </Dialog.Root>
  )
}
