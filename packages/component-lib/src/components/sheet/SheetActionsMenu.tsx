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

import { cn } from '../../utils/cn'
import { useDismiss } from '../shared/useDismiss'
import { SHEET_ICONBTN_CLASS } from './sheetChrome'

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
      {/* Disclosure pattern (aria-expanded only): the popup is a plain group
          of links, not a role=menu widget — aria-haspopup would promise
          menuitem semantics + arrow-key navigation we don't implement. */}
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(SHEET_ICONBTN_CLASS, 'cursor-pointer')}
      >
        <Ellipsis className="size-[18px]" aria-hidden="true" />
      </button>

      {open && (
        // biome-ignore lint/a11y/useSemanticElements: this popover groups arbitrary action buttons — role="menu" would impose menuitem semantics the children don't have, and a fieldset needs a legend; role="group" + aria-label is the right fit
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
