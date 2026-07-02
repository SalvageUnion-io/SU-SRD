/**
 * SheetActionsMenu — the sticky-bar "⋯" overflow (design review U-5).
 *
 * At small widths the condensed sheet bar is too crowded for Edit + Share as
 * standalone controls, so Sheet.tsx folds them into this anchored menu (the
 * caller hides its inline copies below `sm` and hides this menu above it).
 * Non-modal light-dismiss popover: Escape / outside pointerdown close it
 * (both items are links, so choosing one navigates the sheet away). Menu
 * items only mount while open, so the inline Edit/Share copies stay the
 * unique matches for queries in the resting state.
 */

import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'

import { cn } from '../../lib/utils'
import { useDismiss } from '../shared/useDismiss'

type SheetActionsMenuProps = {
  /** Menu items — typically the same Edit link + PublishButton as inline. */
  children: ReactNode
  className?: string
}

export function SheetActionsMenu({ children, className }: SheetActionsMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  useDismiss(rootRef, open, () => setOpen(false))

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[3px] border-chrome border-ink bg-paper text-ink transition-colors duration-[120ms] hover:bg-wk-bg-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25"
      >
        <Ellipsis className="size-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="group"
          aria-label="Sheet actions"
          className="absolute right-0 top-full z-30 mt-1.5 flex min-w-36 flex-col items-stretch gap-1.5 rounded-[6px] border-2 border-ink bg-paper p-2 shadow-[0_14px_28px_-14px_rgba(40,32,25,0.55)]"
        >
          {children}
        </div>
      )}
    </div>
  )
}
