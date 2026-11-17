/**
 * useOpenSheet — what "Sheet" on a Play unit does (play.md §4, §18). On the
 * player's screen it puts that unit's sheet on the screen, in the Actions
 * column (`ShowSheetContext`, provided by `PlayCockpit`); anywhere else (the
 * Mediator's table) it opens the unit's live sheet in Build, at
 * `/<kind>s/$id` (`sheetPath`). Play only plays (ADR-052 §3), so a sheet on
 * the screen is read-only; the seat keeps its state, so Back returns to the
 * same screen.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { sheetPath } from 'game-domain/entityKinds'
import { createContext, useContext } from 'react'
import { useGo } from '../components/shared/useGo'

/** The unit a Sheet control opens. */
export type SheetTarget = { kind: SheetKind; id: string; name: string }

/** Puts a unit's sheet on the player's screen; null where the screen has no room for one. */
export const ShowSheetContext = createContext<((target: SheetTarget) => void) | null>(null)

export function useOpenSheet(): (target: SheetTarget) => void {
  const go = useGo()
  const show = useContext(ShowSheetContext)
  return show ?? ((target) => go(sheetPath(target.kind, target.id)))
}
