/**
 * The rows of "Crew & seats" on a Game's own page (board M2;
 * docs/architecture/play.md §16), from `entities.listForGame`
 * and `games.members`. Pure, so the order and the open seats are testable.
 */

import type { FunctionReturnType } from 'convex/server'
import { sheetPath } from 'game-domain/entityKinds'
import { resolvePool } from 'salvageunion-reference/rules'
import type { api } from '../../../convex/_generated/api'

type Listing = NonNullable<FunctionReturnType<typeof api.entities.listForGame>>
type Members = FunctionReturnType<typeof api.games.members>
/** `crew.vitals`: the server's derived maxima, which the seats' HP reads. */
type Vitals = FunctionReturnType<typeof api.crew.vitals>

/** One row of the seat list. */
export type SeatRow = {
  key: string
  role: 'Mediator' | 'Player' | 'Open'
  who: string
  unit: string
  /**
   * The seat's pilot, as its Row reads it: the callsign and the sheet the Row
   * opens, and the mech assigned to them with its sheet (null on foot). Null
   * for a member with no pilot.
   */
  pilot: { name: string; href: string; mech: string | null; mechHref: string | null } | null
  /** The pilot's `current/max` HP, from `crew.vitals`; null while it loads or with no pilot. */
  hp: string | null
}

/** Each pilot's HP as `current/max`, by its row id; an absent current is full (`resolvePool`). */
function hpById(vitals: Vitals | undefined): Map<string, string> {
  const out = new Map<string, string>()
  for (const p of vitals?.pilots ?? []) {
    if (p.maxHP === null) continue
    // `crew.vitals` sends an unset current as null; `resolvePool` reads undefined as full.
    const current = p.currentHP === null ? undefined : p.currentHP
    out.set(p._id, `${resolvePool(current, p.maxHP)}/${p.maxHP}`)
  }
  return out
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
  viewerId: string | null,
  vitals?: Vitals
): { rows: SeatRow[]; claimed: number; total: number } {
  const hp = hpById(vitals)
  const mechOfPilot = new Map<string, string>()
  for (const link of listing.softLinks) {
    if (link.type === 'mech-to-pilot') mechOfPilot.set(link.to.id, link.from.id)
  }
  const mechName = new Map<string, string>()
  for (const m of listing.mechs) {
    const id = linkId(m)
    if (id !== null) mechName.set(id, text(m.body, 'name') ?? 'a mech')
  }
  const pilotOf = (pilot: Listing['pilots'][number]): NonNullable<SeatRow['pilot']> => {
    const callsign = text(pilot.body, 'callsign') ?? text(pilot.body, 'name') ?? 'Pilot'
    const id = linkId(pilot)
    const mechId = id === null ? undefined : mechOfPilot.get(id)
    const mech = (mechId === undefined ? undefined : mechName.get(mechId)) ?? null
    return {
      name: callsign,
      // The sheet route resolves an app id, a pre-gen's body id or a row id alike.
      href: sheetPath('pilot', id ?? pilot._id),
      mech,
      mechHref: mech === null || mechId === undefined ? null : sheetPath('mech', mechId),
    }
  }
  const unitOf = (pilot: Listing['pilots'][number]): string => {
    const { name, mech } = pilotOf(pilot)
    return `${name} · ${mech ?? 'on foot'}`
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
        pilot: null,
        hp: null,
      })
      continue
    }
    for (const pilot of pilots) {
      rows.push({
        key: pilot._id,
        role,
        who,
        unit: unitOf(pilot),
        pilot: pilotOf(pilot),
        hp: hp.get(pilot._id) ?? null,
      })
    }
  }
  const open = listing.pilots.filter((p) => p.ownerId === null)
  for (const pilot of open) {
    const callsign = text(pilot.body, 'callsign') ?? 'Pilot'
    rows.push({
      key: pilot._id,
      role: 'Open',
      who: callsign,
      unit: 'Waiting for a player',
      pilot: { ...pilotOf(pilot), name: callsign },
      hp: hp.get(pilot._id) ?? null,
    })
  }
  return { rows, claimed: listing.pilots.length - open.length, total: listing.pilots.length }
}
