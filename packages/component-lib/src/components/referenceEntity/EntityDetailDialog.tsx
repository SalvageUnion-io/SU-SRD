import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'

type EntityDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible dialog name (screen-reader only — the card carries the visible title). */
  title: string
  children: ReactNode
}

/**
 * `EntityDetailDialog` — the shared detail-modal chrome: backdrop, the
 * kitty-cornered SRD black-stamp close button, and the scroll wrapper a full
 * entity card needs. It holds NO card of its own, so both the entity path
 * (`useDetailModal`) and the pattern path (a chassis card's pattern rows) put
 * the same window around whatever they render.
 */
export function EntityDetailDialog({
  open,
  onOpenChange,
  title,
  children,
}: EntityDetailDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
        <Dialog.Popup className="fixed inset-0 z-50 m-auto h-fit w-full max-w-6xl bg-transparent px-3 outline-none">
          {/* Overflow lives on the inner scroll wrapper so the close button
              (a sibling) isn't clipped by it. The scroll wrapper's pt-3 leaves
              room for the floating callout row, which straddles ~8px above the
              card's top edge — without it, overflow-y-auto clips the callout.
              The SRD black-stamp square button is kitty-cornered, straddling the
              card's top-right corner. */}
          <div className="relative">
            <Dialog.Close className="absolute -top-2 -right-2 z-[60] flex h-9 w-9 cursor-pointer items-center justify-center rounded-card border-2 border-paper bg-ink text-paper shadow-lg transition-colors hover:bg-rust">
              <X className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
            <div className="max-h-[calc(100vh-4rem)] overflow-y-auto pt-3">
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              <Dialog.Description className="sr-only">Entity display details</Dialog.Description>
              {children}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
