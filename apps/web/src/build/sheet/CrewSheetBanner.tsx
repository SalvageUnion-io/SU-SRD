/**
 * CrewSheetBanner — a crewmate's sheet, read-only, under the caution banner
 * that says why (`SheetView`, `NpcSheetView`).
 *
 * Saying WHY it is read-only matters more than saying that it is: a player
 * who cannot edit a crewmate's pilot should read that as the rule of the
 * table, not as something broken.
 */

import type { EntityKind } from 'game-domain/entityKinds'
import type { ReactNode } from 'react'
import { buildSheetCopy } from '../../messages/build-sheet'
import { READ_ONLY_BANNER } from './readOnlyBanner.model'

const WHY: Record<EntityKind, string> = {
  pilot: buildSheetCopy('whyCrewmateSheet'),
  mech: buildSheetCopy('whyCrewmateSheet'),
  crawler: buildSheetCopy('whyCrewCrawler'),
  npc: buildSheetCopy('whyCrewmateNpc'),
}

export function CrewSheetBanner({
  kind,
  unassigned = false,
  children,
}: {
  kind: EntityKind
  /** A pilot or mech assigned to nobody: no crewmate holds it (MD-23). */
  unassigned?: boolean
  children: ReactNode
}) {
  return (
    <div className="su-page-gutters">
      <div
        role="note"
        aria-label={buildSheetCopy('readOnlyCrewSheet')}
        // Its gutter is `.su-sheet-gutter`.
        className="su-sheet-gutter"
        style={READ_ONLY_BANNER}
      >
        {unassigned ? buildSheetCopy('readOnlyUnassignedSheet') : WHY[kind]}
      </div>
      {children}
    </div>
  )
}
