import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { SearchIsland } from './SearchIsland'

/**
 * Persistent search trigger for the mobile top nav bar. On phones search is the
 * primary action, so it lives directly in the bar (not buried in the hamburger
 * drawer). Tapping the icon opens a full-screen sheet hosting the existing
 * SearchIsland combobox — same ARIA, same deferred data load. base-ui's Dialog
 * only mounts the sheet (and its SearchIsland) while open, so it adds no cost to
 * the closed state and traps focus once opened.
 */
export function MobileSearchIsland() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          // size-11 = 44px — meets the WCAG 2.5.5 minimum touch-target size.
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-panel text-paper"
            aria-label="Search the SRD"
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
            <Dialog.Title className="font-mono text-sm font-bold uppercase text-ink">
              Search
            </Dialog.Title>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="flex size-11 items-center justify-center rounded-panel text-ink"
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
          {/* Force the combobox input (fixed w-52 by default) to fill the sheet. */}
          <div className="[&_input]:w-full [&_input]:focus:w-full">
            <SearchIsland />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
