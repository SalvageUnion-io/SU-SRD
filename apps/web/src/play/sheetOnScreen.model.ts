/**
 * A sheet on the Play screen (play.md §18): which unit's sheet stands in the
 * Actions column (below `lg`, in the open pane's place), and the units the
 * pane's picker offers. Play only plays (ADR-052 §3): the sheet is read-only,
 * and yours carries "Edit in Build".
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { PartnerInstance } from 'game-domain/schemas/partner'
import { partnerDisplayName } from '../build/sheet/partnerDisplay.model'

/**
 * A unit whose sheet can stand on the screen: a pilot, mech or crawler, or a
 * companion (a partner, which lives on its host pilot or mech and so names
 * it).
 */
export type SheetChoice =
  | { kind: SheetKind; id: string; name: string; yours: boolean }
  | {
      kind: 'partner'
      id: string
      name: string
      yours: boolean
      host: { kind: 'pilot' | 'mech'; id: string }
    }

/** What the screen shows: the unit, or null while Actions stands. */
export type ShownSheet = SheetChoice | null

const KIND_ORDER: Record<SheetChoice['kind'], number> = {
  pilot: 0,
  mech: 1,
  crawler: 2,
  partner: 3,
}

const byKindThenName = (a: SheetChoice, b: SheetChoice) =>
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name)

/**
 * The picker's sections: yours first (this screen's pilot leading), then the
 * rest of the table's, each pilot, then mech, then crawler, then companion,
 * by name. A unit
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

/**
 * A host's companions as picker choices: a pilot's ability-granted partners,
 * a mech's chassis drones. A host body read from a Game listing is unparsed,
 * so a partner without an id or a stat block reference is left out.
 */
export function partnerChoices(
  host: { kind: 'pilot' | 'mech'; id: string; partners?: unknown },
  yours: boolean
): SheetChoice[] {
  const list = Array.isArray(host.partners) ? (host.partners as unknown[]) : []
  return list.flatMap((raw) => {
    const p = raw as Partial<PartnerInstance> | null
    if (!p || typeof p.id !== 'string' || typeof p.hostRef !== 'string') return []
    return [
      {
        kind: 'partner' as const,
        id: p.id,
        name: partnerDisplayName(p as PartnerInstance),
        yours,
        host: { kind: host.kind, id: host.id },
      },
    ]
  })
}
