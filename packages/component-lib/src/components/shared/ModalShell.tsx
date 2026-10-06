import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
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
  children?: ReactNode
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
  children,
}: ModalShellProps) {
  // `tone` is the whole API now. It replaced a `headerBg` raw-class prop whose
  // behaviour hung on a string comparison (`headerBg === 'bg-adversary'`) — a
  // shape that had already survived one token migration only because a sweep
  // happened to rewrite the literal alongside the token. A union removes the
  // class of bug rather than fixing an instance of it.
  const isDanger = tone === 'danger'
  const headerBgClass = isDanger ? 'bg-status-bad' : 'bg-pilot'

  // Bare mode: a fit-height, non-scrolling popup — the child owns its frame and
  // any internal scroll. Default: a scrolling popup wrapping the Card.
  const overflow = bare ? 'overflow-hidden' : 'overflow-y-auto'
  const width = maxWidth ?? (role === 'alertdialog' ? 'max-w-md' : 'max-w-3xl')

  // The two roots share every part below — AlertDialog re-exports Dialog's
  // Portal/Popup/Title/Description/Close — so only the root differs.
  const Root = role === 'alertdialog' ? AlertDialog.Root : Dialog.Root

  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
        <Dialog.Popup
          initialFocus={initialFocus}
          className={`fixed inset-0 z-50 h-fit max-h-[calc(100vh-4rem)] w-full ${width} ${overflow} bg-transparent outline-none ${align === 'center' ? 'm-auto' : 'mx-auto mt-8 mb-auto'}`}
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
    </Root>
  )
}
