/**
 * AppHeaderMobileMenu — the hamburger + slide-in drawer that holds AppHeader's
 * secondary nav below the `lg` breakpoint.
 *
 * Mirrors the SRD reference site's mobile pattern
 * (apps/suref-web/.../islands/MobileNavIsland.tsx): a base-ui `Dialog` with a
 * hamburger `Dialog.Trigger`, a dimmed `Dialog.Backdrop`, and a full-height,
 * right-side `Dialog.Popup` that slides in via the shared
 * `animate-slide-in-right`/`-out` utilities (see src/index.css). Below `lg`,
 * AppHeader collapses its Encounter / SRD / Buy links in here so the header row
 * never overflows on a phone; search stays inline as its own icon button.
 */

import { Dialog } from '@base-ui/react/dialog'
import { Menu, X } from 'lucide-react'

import { AppLink } from './AppLink'

// Full-width vertical restatements of AppHeader's `.nav-link`/buy-button looks,
// sized up for touch targets inside the drawer.
const DRAWER_LINK =
  'flex items-center rounded-md border border-su-black bg-su-white px-4 py-3 font-cond text-base font-semibold uppercase tracking-[0.04em] text-su-black no-underline transition-colors hover:border-su-orange-dark hover:text-su-orange-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange'

const DRAWER_BUY =
  'flex items-center justify-center rounded-md border border-su-orange-dark bg-su-orange-dark px-4 py-3 font-cond text-base font-medium uppercase tracking-[0.06em] text-su-white no-underline transition-colors hover:bg-su-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange'

// Small "Alpha" pill — same rust treatment as HeaderShell's "Beta" badge.
const ALPHA_TAG =
  'ml-2 inline-block rounded bg-rust px-1.5 py-0.5 font-cond text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-su-paper'

export function AppHeaderMobileMenu() {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        render={
          <button
            type="button"
            aria-label="Open menu"
            className="flex items-center justify-center rounded-md p-1.5 text-su-paper transition-colors hover:text-su-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange"
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>
        }
      />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col bg-su-white p-4 shadow-lg data-[closed]:animate-slide-out-right data-[open]:animate-slide-in-right">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>

          {/* Header row: wordmark tag | Close */}
          <div className="mb-4 flex items-center justify-between">
            <span className="inline-flex shrink-0 border border-su-black font-cond text-sm font-bold uppercase leading-none tracking-tight">
              <span className="bg-su-black px-1.5 py-1 text-su-white">In the Union</span>
              <span className="bg-su-white px-1.5 py-1 text-su-black">Now</span>
            </span>
            <Dialog.Close
              render={
                <button
                  type="button"
                  aria-label="Close menu"
                  className="flex items-center justify-center rounded-md p-1 text-su-black/60 transition-colors hover:bg-su-black/10 hover:text-su-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              }
            />
          </div>

          {/* Nav links */}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            <Dialog.Close
              render={
                <AppLink href="/encounter" className={DRAWER_LINK}>
                  Encounter
                  <span className={ALPHA_TAG}>Alpha</span>
                </AppLink>
              }
            />
            <a
              href="https://salvageunion.io/discord/"
              target="_blank"
              rel="noopener noreferrer"
              className={DRAWER_LINK}
            >
              Discord&nbsp;&#8599;
            </a>
            <a
              href="https://salvageunion.io"
              target="_blank"
              rel="noopener noreferrer"
              className={DRAWER_LINK}
            >
              SalvageUnion.io SRD&nbsp;&#8599;
            </a>

            <a
              href="https://leyline.press/collections/salvage-union"
              target="_blank"
              rel="noopener noreferrer"
              className={`${DRAWER_BUY} mt-auto`}
            >
              Buy the game
            </a>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
