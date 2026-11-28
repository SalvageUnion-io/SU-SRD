/**
 * What a member holds in a Game, as the Leave and Remove dialogs name it
 * (LG4-03), pure: the pilots and mechs they brought go back to their Training
 * Bay; the ones the Game came with (a template's pre-gens, `templateUnitIds`
 * on the Game's read) stay on the roster, unassigned. It mirrors the room's
 * own split (`roster.leaving`).
 */

import { pilotLabel } from 'game-domain/pilotLabel'
import type { ServerOwnable } from '../../lib/games/gameRoster'

export type HeldByMember = {
  /** Names of what goes back to their Training Bay. */
  home: string[]
  /** Names of the Game's own, which stay here unassigned. */
  staying: string[]
}

const bodyOf = (row: ServerOwnable) => (row.body ?? {}) as Record<string, unknown>

const mechName = (row: ServerOwnable) => {
  const name = bodyOf(row).name
  return typeof name === 'string' && name !== '' ? name : 'Mech'
}

export function heldByMember(
  listing: { pilots: readonly ServerOwnable[]; mechs: readonly ServerOwnable[] } | undefined,
  templateUnitIds: readonly string[] | undefined,
  userId: string
): HeldByMember {
  const own = new Set(templateUnitIds ?? [])
  const held = [
    ...(listing?.pilots ?? []).map((row) => ({ row, name: pilotLabel(bodyOf(row)) })),
    ...(listing?.mechs ?? []).map((row) => ({ row, name: mechName(row) })),
  ].filter(({ row }) => row.ownerId === userId)
  return {
    home: held.filter(({ row }) => !own.has(row._id)).map(({ name }) => name),
    staying: held.filter(({ row }) => own.has(row._id)).map(({ name }) => name),
  }
}
