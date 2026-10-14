import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { color, fontSize, space } from '../../design/tokens'
import { Badge } from '../atoms/Badge'
import { Card } from './Card'

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
   * `'alertdialog'` renders Base UI's AlertDialog instead of Dialog:
   * `role="alertdialog"`, and a backdrop click does NOT dismiss it (Escape and
   * the × still do), because a confirm has to be answered rather than clicked
   * past. Reach for it through `ConfirmDialog`, not directly.
   */
  role?: 'dialog' | 'alertdialog'
  /**
   * Header tone (ruleset §6): 'action' (pilot blue, the default) for
   * constructive flows, 'danger' (adversary rust) for destructive confirms.
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
   * Chromeless: skip the Card header/frame and render `children` as the
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
const CONTAINED_BACKDROP: CSSProperties = { position: 'absolute' }
const CONTAINED_POPUP: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 50,
  outline: 'none',
}

/** The default popup: a fit-height box centred over the scrim. */
const POPUP: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  height: 'fit-content',
  maxHeight: 'calc(100vh - 4rem)',
  width: '100%',
  backgroundColor: 'transparent',
  outline: 'none',
}

const HEAD = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[8],
} satisfies CSSProperties

const TITLES = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: space[2],
} satisfies CSSProperties

/** A stamp sized over the stamp ladder's top rung, as a single-line plate. */
const STAMP = {
  display: 'block',
  alignSelf: 'flex-start',
  lineHeight: 1,
} satisfies CSSProperties

const SUBTITLE = {
  ...STAMP,
  fontSize: fontSize.xs,
  color: `color-mix(in oklab, ${color.paper} 80%, transparent)`,
} satisfies CSSProperties

const CLOSE_ICON = { width: space[20], height: space[20] } satisfies CSSProperties

/** A full-screen popup covers the viewport and scrolls inside itself. */
const FULLSCREEN_POPUP: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  overflowY: 'auto',
  outline: 'none',
}

export function ModalShell({
  open,
  onOpenChange,
  title,
  subtitle,
  description,
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
  const isDanger = tone === 'danger'
  const headerBgColor = isDanger ? 'var(--color-status-bad)' : 'var(--color-pilot)'

  // Bare mode: a fit-height, non-scrolling popup — the child owns its frame and
  // any internal scroll. Default: a scrolling popup wrapping the Card.
  const popupStyle: CSSProperties = {
    ...POPUP,
    ...(bare ? { overflow: 'hidden' } : { overflowY: 'auto' }),
    // A caller's `maxWidth` class sets the cap; inline, the default would beat it.
    ...(maxWidth ? {} : { maxWidth: role === 'alertdialog' ? '28rem' : '48rem' }),
    margin: align === 'center' ? 'auto' : `${space[32]} auto auto`,
  }

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
        <Dialog.Title className="su-sr-only">{title}</Dialog.Title>
        {description !== null && (
          <Dialog.Description className="su-sr-only">{description ?? title}</Dialog.Description>
        )}

        {bare ? (
          children
        ) : (
          <Card
            headerBgColor={headerBgColor}
            headerContent={
              <div style={HEAD}>
                <div style={TITLES}>
                  {/*
                   * `xl` / `2xl` sit ABOVE the stamp ladder's top rung
                   * (`full` = `sm`), so the dialog title keeps an explicit
                   * font-size override rather than inventing a new rung, at
                   * line-height 1: the stamp is a single-line plate.
                   */}
                  <Badge
                    shape="stamp"
                    size="mini"
                    style={{
                      ...STAMP,
                      fontSize: isDanger ? fontSize.xl : fontSize['2xl'],
                      color: color.paper,
                    }}
                  >
                    {title}
                  </Badge>
                  {subtitle && (
                    <Badge shape="stamp" size="mini" style={SUBTITLE}>
                      {subtitle}
                    </Badge>
                  )}
                </div>
                <Dialog.Close
                  className="su-modal-close"
                  data-tone={isDanger ? 'danger' : undefined}
                >
                  <X style={CLOSE_ICON} />
                  <span className="su-sr-only">Close</span>
                </Dialog.Close>
              </div>
            }
          >
            {children}
          </Card>
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
