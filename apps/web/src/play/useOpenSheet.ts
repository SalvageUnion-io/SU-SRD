/**
 * useOpenSheet — what "Sheet" on a Play unit does (play.md §4): it opens that
 * unit's live sheet in Build, at `/<kind>s/$id` (`sheetPath`). Play only plays
 * (ADR-052 §3), so it carries no second sheet
 * of its own; the seat keeps its state, so Back returns to the same screen.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { sheetPath } from 'game-domain/entityKinds'
import { useGo } from '../components/shared/useGo'

/** The unit a Sheet control opens. */
export type SheetTarget = { kind: SheetKind; id: string; name: string }

export function useOpenSheet(): (target: SheetTarget) => void {
  const go = useGo()
  return (target) => go(sheetPath(target.kind, target.id))
}
