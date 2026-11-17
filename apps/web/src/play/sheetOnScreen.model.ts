/**
 * A sheet on the Play screen (play.md §18): which unit's sheet stands in the
 * Actions column (below `lg`, in the open pane's place), and the units the
 * pane's picker offers. Play only plays (ADR-052 §3): the sheet is read-only,
 * and yours carries "Edit in Build".
 */

import type { SheetKind } from 'game-domain/entityKinds'

/** A unit whose sheet can stand on the screen. */
export type SheetChoice = { kind: SheetKind; id: string; name: string; yours: boolean }

/** What the screen shows: the unit, or null while Actions stands. */
export type ShownSheet = SheetChoice | null

const KIND_ORDER: Record<SheetKind, number> = { pilot: 0, mech: 1, crawler: 2 }

const byKindThenName = (a: SheetChoice, b: SheetChoice) =>
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name)

/**
 * The picker's sections: yours first (this screen's pilot leading), then the
 * rest of the table's, each pilot, then mech, then crawler, by name. A unit
 * listed twice (held and listed) appears once; one with no name is left out.
 */
export function sheetChoiceSections(
  choices: readonly SheetChoice[],
  selfPilotId: string | null
): SheetChoice[][] {
  const seen = new Set<string>()
  const unique = choices.filter((c) => {
    const key = `${c.kind}:${c.id}`
    if (seen.has(key) || c.name.trim() === '') return false
    seen.add(key)
    return true
  })
  const lead = (c: SheetChoice) => (c.kind === 'pilot' && c.id === selfPilotId ? 0 : 1)
  const yours = unique
    .filter((c) => c.yours)
    .sort((a, b) => lead(a) - lead(b) || byKindThenName(a, b))
  const theirs = unique.filter((c) => !c.yours).sort(byKindThenName)
  return [yours, theirs].filter((section) => section.length > 0)
}

/** A listed row's name: its body's `name`, else empty (left out of the picker). */
export function listedName(body: unknown): string {
  const name = (body as { name?: unknown } | null)?.name
  return typeof name === 'string' ? name : ''
}
