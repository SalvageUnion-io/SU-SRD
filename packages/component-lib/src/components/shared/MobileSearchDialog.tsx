import { Dialog } from '@base-ui/react/dialog'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { cn } from '../../utils/cn'
import { buttonVariants } from '../chrome/buttonVariants'

type MobileSearchDialogProps = {
  /**
   * The search UI hosted inside the sheet (e.g. srd's `SearchIsland`). It only
   * mounts while the sheet is open, so its data load stays deferred to first
   * open. The caller owns any content-specific styling (input width, etc.).
   */
  children: ReactNode
  /** Sheet heading. Defaults to "Search". */
  title?: string
  /** Accessible label for the trigger icon button. Defaults to "Search". */
  triggerAriaLabel?: string
}

/**
 * Persistent search trigger + full-screen sheet for a mobile top nav bar. On
 * phones search is the primary action, so it lives directly in the bar (not
 * buried in the hamburger drawer). Tapping the magnifier opens a top sheet that
 * hosts arbitrary search `children` (srd passes its `SearchIsland`).
 *
 * Content-agnostic shell: it owns the trigger, the sheet chrome (title + close),
 * focus trapping, and the slide animation; the caller injects the search UI.
 * base-ui's Dialog only mounts the sheet (and its children) while open, so it
 * adds no cost to the closed state.
 */
export function MobileSearchDialog({
  children,
  title = 'Search',
  triggerAriaLabel = 'Search',
}: MobileSearchDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          // size-11 = 44px — meets the WCAG 2.5.5 minimum touch-target size,
          // the one documented override on the shared icon rung. `ghost` +
          // `border-transparent` keeps the bar's flat look while the rung
          // supplies the focus ring this trigger simply did not have.
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'iconOnly' }),
              'size-11 rounded-panel border-transparent text-paper hover:bg-paper/15'
            )}
            aria-label={triggerAriaLabel}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        }
      />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-ink/50" />
        <Dialog.Popup className="fixed inset-x-0 top-0 z-50 flex flex-col gap-3 bg-paper p-4 shadow-lg data-[open]:animate-slide-in-right data-[closed]:animate-slide-out-right">
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-cond text-sm font-bold uppercase text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'iconOnly' }),
                    'size-11 rounded-panel border-transparent text-ink'
                  )}
                  aria-label="Close search"
                >
                  <svg
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              }
            />
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
