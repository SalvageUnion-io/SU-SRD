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
import { READ_ONLY_BANNER } from './readOnlyBanner.model'

const WHY: Record<EntityKind, string> = {
  pilot: 'You are reading a crewmate’s sheet. Only whoever holds it can make changes.',
  mech: 'You are reading a crewmate’s sheet. Only whoever holds it can make changes.',
  crawler: 'This is the crew’s crawler. Only the Mediator changes it; ask at the table.',
  npc: 'You are reading a crewmate’s NPC. Only whoever made it can change it.',
}

export function CrewSheetBanner({ kind, children }: { kind: EntityKind; children: ReactNode }) {
  return (
    <div className="su-page-gutters">
      <div
        role="note"
        aria-label="Read-only crew sheet"
        // Its gutter is `.su-sheet-gutter`.
        className="su-sheet-gutter"
        style={READ_ONLY_BANNER}
      >
        {WHY[kind]}
      </div>
      {children}
    </div>
  )
}
