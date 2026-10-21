/**
 * Who holds each unit a sheet lists (ADR-030 §6): a Game's pilots and mechs,
 * from its listing (`entities.listForGame`) and its members (`games.members`),
 * as the roster's owner seal reads them (`ownerChipFor`): YOU, a crewmate's
 * name, or UNCLAIMED. Every sheet's Assigned units wear it on each Mini's head
 * (R49).
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { ServerOwnable } from '../../lib/games/gameRoster'
import type { OwnerChip } from '../../lib/ownership/ownerChip'
import { ownerChipFor } from '../../lib/ownership/ownerChip'

/** A unit's owner chip, by its kind and app id; `undefined` outside a Game's listing. */
export type OwnerOf = (kind: SheetKind, id: string) => OwnerChip | undefined

/** A listed row's app id: its `appId`, else its body's own `id`. */
function rowId(row: ServerOwnable): string | null {
  if (row.appId !== null) return row.appId
  const id = (row.body as { id?: unknown } | null)?.id
  return typeof id === 'string' ? id : null
}

/** The owner chip of every pilot and mech the Game lists. */
export function ownersFromListing(
  listing: { pilots: readonly ServerOwnable[]; mechs: readonly ServerOwnable[] },
  members: readonly { userId: string; displayName: string }[],
  viewerId: string | null
): OwnerOf {
  const lookup = {
    viewerId,
    namesById: new Map(members.map((member) => [member.userId, member.displayName])),
  }
  const byKey = new Map<string, OwnerChip>()
  for (const [kind, rows] of [
    ['pilot', listing.pilots],
    ['mech', listing.mechs],
  ] as const) {
    for (const row of rows) {
      const id = rowId(row)
      if (id !== null) byKey.set(`${kind}:${id}`, ownerChipFor(row.ownerId, lookup))
    }
  }
  return (kind, id) => byKey.get(`${kind}:${id}`)
}
