/**
 * The rows of "Crew & seats" on a Game's own page (board M2;
 * docs/architecture/mediator-dashboard.md Q11), from `entities.listForGame`
 * and `games.members`. Pure, so the order and the open seats are testable.
 */

import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'

type Listing = NonNullable<FunctionReturnType<typeof api.entities.listForGame>>
type Members = FunctionReturnType<typeof api.games.members>

/** One row of the seat list. */
export type SeatRow = {
  key: string
  role: 'Mediator' | 'Player' | 'Open'
  who: string
  unit: string
}

const text = (body: unknown, key: string): string | null => {
  const value = (body as Record<string, unknown> | null)?.[key]
  return typeof value === 'string' && value !== '' ? value : null
}

/** The id links name a row by: its app id, or a template pre-gen's body id. */
const linkId = (row: { appId: string | null; body: unknown }): string | null =>
  row.appId ?? text(row.body, 'id')

/**
 * The rows, in join order: each member's pilots (or one "Runs the table" /
 * "No pilot yet" row), then the open seats.
 */
export function seatRows(
  listing: Listing,
  members: Members,
  viewerId: string | null
): { rows: SeatRow[]; claimed: number; total: number } {
  const mechOfPilot = new Map<string, string>()
  for (const link of listing.softLinks) {
    if (link.type === 'mech-to-pilot') mechOfPilot.set(link.to.id, link.from.id)
  }
  const mechName = new Map<string, string>()
  for (const m of listing.mechs) {
    const id = linkId(m)
    if (id !== null) mechName.set(id, text(m.body, 'name') ?? 'a mech')
  }
  const unitOf = (pilot: Listing['pilots'][number]): string => {
    const callsign = text(pilot.body, 'callsign') ?? text(pilot.body, 'name') ?? 'Pilot'
    const id = linkId(pilot)
    const mech = id === null ? undefined : mechOfPilot.get(id)
    const name = mech === undefined ? undefined : mechName.get(mech)
    return `${callsign} · ${name ?? 'on foot'}`
  }

  const rows: SeatRow[] = []
  const ordered = [...members].sort((a, b) => a.joinedAt - b.joinedAt)
  for (const member of ordered) {
    const pilots = listing.pilots.filter((p) => p.ownerId === member.userId)
    const role = member.mediator ? 'Mediator' : 'Player'
    const who = member.userId === viewerId ? `${member.displayName} (you)` : member.displayName
    if (pilots.length === 0) {
      rows.push({
        key: member.userId,
        role,
        who,
        unit: member.mediator ? 'Runs the table' : 'No pilot yet',
      })
      continue
    }
    for (const pilot of pilots) {
      rows.push({ key: pilot._id, role, who, unit: unitOf(pilot) })
    }
  }
  const open = listing.pilots.filter((p) => p.ownerId === null)
  for (const pilot of open) {
    const callsign = text(pilot.body, 'callsign') ?? 'Pilot'
    rows.push({ key: pilot._id, role: 'Open', who: callsign, unit: 'Waiting for a player' })
  }
  return { rows, claimed: listing.pilots.length - open.length, total: listing.pilots.length }
}
