/**
 * SheetActionsMenu — the sticky-bar "⋯" overflow (design review U-5).
 *
 * At small widths the condensed sheet bar is too crowded for every sheet
 * action, so Sheet.tsx folds the reads and admin moves (Print, Export, the
 * container move, the Change Log) into this anchored panel — component-lib's
 * `PopoverPanel`: non-modal, closed by Escape, a press outside it or the
 * trigger, focus back on the trigger. Its items only mount while open, so
 * whatever an item opens (the Change Log, a confirm) keeps its state on the
 * always-mounted Sheet.
 */

import { cn, PopoverPanel } from 'component-lib'
import { Ellipsis } from 'lucide-react'
import type { ReactNode } from 'react'
import { SHEET_ICONBTN_CLASS } from './sheetChrome'

type SheetActionsMenuProps = {
  /** The actions — buttons and controls, not menu items. */
  children: ReactNode
  className?: string
}

export function SheetActionsMenu({ children, className }: SheetActionsMenuProps) {
  return (
    // A disclosure, not a role=menu widget: the panel holds arbitrary controls,
    // and menu semantics would promise menuitem roles and arrow-key navigation
    // they do not have.
    <PopoverPanel
      label="Sheet actions"
      trigger={
        <button
          type="button"
          aria-label="More actions"
          className={cn(SHEET_ICONBTN_CLASS, 'cursor-pointer', className)}
        >
          <Ellipsis className="size-[18px]" aria-hidden="true" />
        </button>
      }
    >
      {children}
    </PopoverPanel>
  )
}
