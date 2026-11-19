/**
 * SheetView — MOCK (density mock, "best" variant): a sheet's two views.
 *
 * A Live Sheet reads two ways, and one switch in its masthead picks which
 * (owner, 2026-11-19: "essentially 'actions view' or 'contextual view'"):
 *
 *   Sheet    what the unit IS and HAS, in the printed sheet's order: each
 *            System, Module, Ability and item in its own list, with what it
 *            costs to fit and to use. The default.
 *   Actions  what the unit can DO, every action of every source in one deck
 *            grouped by action type (Turn, Short, Long, Reaction, Free,
 *            Downtime, Passive), as Play's board groups them (R65).
 *
 * The masthead (vitals, figures, identity) never moves: only the body under
 * it switches. `Segmented` is the control (chrome K10 would call a region
 * switch `Tabs`; a two-way view is closer to the sheet's own Read | Edit,
 * which is a Segmented, so the two sit alike in one head).
 */

import { useState } from 'react'
import { Segmented, SegmentedOption } from '../../components/index'

export type SheetViewKey = 'sheet' | 'actions'

/** MOCK: `?view=actions` starts in the Actions view, so a screenshot can show it. */
function initialView(): SheetViewKey {
  if (typeof window === 'undefined') return 'sheet'
  return new URLSearchParams(window.location.search).get('view') === 'actions' ? 'actions' : 'sheet'
}

// biome-ignore lint/style/useComponentExportOnlyModules: MOCK, the switch's own state beside it
export function useSheetView() {
  return useState<SheetViewKey>(initialView)
}

export function SheetViewSwitch({
  view,
  onChange,
  count,
}: {
  view: SheetViewKey
  onChange: (next: SheetViewKey) => void
  /** How many actions the Actions view holds. */
  count: number
}) {
  return (
    // MOCK: the words belong in the message catalogue.
    <Segmented label="View" size="compact">
      <SegmentedOption pressed={view === 'sheet'} onClick={() => onChange('sheet')}>
        Sheet
      </SegmentedOption>
      <SegmentedOption pressed={view === 'actions'} onClick={() => onChange('actions')}>
        Actions <span className="su-mast__view-count">{count}</span>
      </SegmentedOption>
    </Segmented>
  )
}
