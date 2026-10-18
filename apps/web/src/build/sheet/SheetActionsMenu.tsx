/**
 * SheetActionsMenu — the sticky-bar "⋯" overflow.
 *
 * At small widths the condensed sheet bar is too crowded for every sheet
 * action, so Sheet.tsx folds the reads and admin moves (Print, Export, the
 * container move, the Change Log) into this anchored panel — the UI library's
 * `PopoverPanel`: non-modal, closed by Escape, a press outside it or the
 * trigger, focus back on the trigger. Its items only mount while open, so
 * whatever an item opens (the Change Log, a confirm) keeps its state on the
 * always-mounted Sheet.
 */

import { Ellipsis } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Button, PopoverPanel } from '../../components/index'

const ICON = { height: '18px', width: '18px' } satisfies CSSProperties

type SheetActionsMenuProps = {
  /** The actions — buttons and controls, not menu items. */
  children: ReactNode
}

export function SheetActionsMenu({ children }: SheetActionsMenuProps) {
  return (
    // A disclosure, not a role=menu widget: the panel holds arbitrary controls,
    // and menu semantics would promise menuitem roles and arrow-key navigation
    // they do not have.
    <PopoverPanel
      label="Sheet actions"
      trigger={
        // The icon rung at the page-top control height (`.su-page-action`),
        // which the library squares to it.
        <Button size="iconOnly" aria-label="More actions" className="su-page-action">
          <Ellipsis style={ICON} aria-hidden="true" />
        </Button>
      }
    >
      {children}
    </PopoverPanel>
  )
}
