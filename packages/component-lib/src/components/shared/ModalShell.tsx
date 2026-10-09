import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { Badge } from '../chrome/Badge'
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
   * Tailwind max-width class. Defaults to `max-w-3xl`, or `max-w-md` for an
   * `alertdialog` — the narrow width every confirm in the apps had already
   * chosen by hand.
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
   * and need its `.pc-root` styling.
   */
  container?: RefObject<HTMLElement | null>
  /** Element to focus when the dialog closes (defaults to base-ui's: the
   *  trigger, or whatever held focus before it opened). */
  finalFocus?: RefObject<HTMLElement | null>
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
  children,
}: ModalShellProps) {
  // `tone` is the whole API: a union, never a raw class string compared by
  // value, so a token rename cannot silently change the behaviour.
  const isDanger = tone === 'danger'
  const headerBgClass = isDanger ? 'bg-status-bad' : 'bg-pilot'

  // Bare mode: a fit-height, non-scrolling popup — the child owns its frame and
  // any internal scroll. Default: a scrolling popup wrapping the Card.
  const overflow = bare ? 'overflow-hidden' : 'overflow-y-auto'
  const width = maxWidth ?? (role === 'alertdialog' ? 'max-w-md' : 'max-w-3xl')

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
        className={
          container
            ? undefined
            : `fixed inset-0 z-50 h-fit max-h-[calc(100vh-4rem)] w-full ${width} ${overflow} bg-transparent outline-none ${align === 'center' ? 'm-auto' : 'mx-auto mt-8 mb-auto'}`
        }
        style={container ? CONTAINED_POPUP : undefined}
      >
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {description !== null && (
          <Dialog.Description className="sr-only">{description ?? title}</Dialog.Description>
        )}

        {bare ? (
          children
        ) : (
          <Card
            headerBg={headerBgClass}
            headerContent={
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  {/*
                   * `text-xl` / `text-2xl` sit ABOVE the stamp ladder's top
                   * rung (`full` = `text-sm`), so the dialog title keeps an
                   * explicit font-size override rather than inventing a new
                   * rung. `leading-none` must trail it — a font-size utility
                   * reinstates its own line-height, and the stamp is a
                   * single-line plate.
                   */}
                  <Badge
                    shape="stamp"
                    size="mini"
                    className={`${isDanger ? 'text-xl' : 'text-2xl'} block self-start leading-none text-paper`}
                  >
                    {title}
                  </Badge>
                  {subtitle && (
                    <Badge
                      shape="stamp"
                      size="mini"
                      className="block self-start text-xs leading-none text-paper/80"
                    >
                      {subtitle}
                    </Badge>
                  )}
                </div>
                <Dialog.Close
                  className={`flex shrink-0 cursor-pointer items-center justify-center rounded p-1 transition-colors ${
                    isDanger
                      ? 'text-paper/60 hover:bg-ink/20 hover:text-paper'
                      : 'text-ink/60 hover:bg-ink/20 hover:text-ink'
                  }`}
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
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
