/**
 * The bot's `mine` and `sheet` (`/su sheet`), answered from the rooms: the
 * caller's account room for their Shelf, and each Game room they belong to
 * (from the shared database's memberships). Rooms name people by Discord id,
 * so that is the actor every call passes; a room answers a stranger nothing.
 *
 * A sheet nobody lets the caller reach may still be published (ADR-032):
 * its `/p/` page, from the shared database, serves the body. A room derives
 * a unit's vitals with the unit; a room that sends none, or a sheet read
 * from its public page, reads as "maxima unknown".
 */

import { botDenial, SHEET_NOT_FOUND } from 'game-domain/botDenials'
import type {
  BotFailure,
  BotSuccess,
  EntityBody,
  MineResult,
  SheetResult,
  SheetVitals,
} from 'game-domain/botWire'
import type { EntityKind, SheetKind, SheetTable } from 'game-domain/entityKinds'
import { SHEET_KINDS, TABLE_OF_KIND } from 'game-domain/entityKinds'
import { accountByDiscordId } from './shared/accounts'
import type { SharedDb } from './shared/db'
import { gamesOf } from './shared/games'
import { publicPage } from './shared/publicSheets'

/** One unit as a room hands it to the bot. */
type RoomUnit = { id: string; kind: EntityKind; body: EntityBody }

/** One unit read alone, with its derived vitals when the room sends them. */
type RoomSheet = RoomUnit & { vitals?: SheetVitals | null }

/** The two room calls the bot makes, on either kind of room. */
type UnitReader<U> = {
  unitsFor(actor: string): Promise<RoomUnit[]>
  unit(actor: string, unitId: string): Promise<U | null>
}

/** The rooms, by name: an account room by Discord id, a Game room by Game id. */
export type BotRooms = {
  account(discordId: string): UnitReader<RoomSheet>
  game(gameId: string): UnitReader<RoomSheet & { ownerName: string | null }>
}

const KIND_OF_TABLE = Object.fromEntries(
  SHEET_KINDS.map((kind) => [TABLE_OF_KIND[kind], kind])
) as Record<SheetTable, SheetKind>

/** Every pilot, mech and crawler the caller owns, and each of their Games' crawler. */
export async function mine(
  db: SharedDb,
  rooms: BotRooms,
  discordId: string
): Promise<BotFailure | BotSuccess<MineResult>> {
  const account = await accountByDiscordId(db, discordId)
  if (account === null) return botDenial('unlinked')
  const games = await gamesOf(db, account.account_id)
  const lists = await Promise.all([
    rooms.account(discordId).unitsFor(discordId),
    ...games.map((game) => rooms.game(game.gameId).unitsFor(discordId)),
  ])
  // Keyed by id: a crawler you own can also be a Game's primary one.
  const units = [...new Map(lists.flat().map((unit) => [unit.id, unit])).values()]
  const of = (kind: SheetKind) =>
    units.filter((unit) => unit.kind === kind).map((unit) => ({ id: unit.id, body: unit.body }))
  return { ok: true, pilots: of('pilot'), mechs: of('mech'), crawlers: of('crawler') }
}

/** The room unit `unitId` of `kind` the caller may read, with whose it is; null for none. */
async function reachable(
  db: SharedDb,
  rooms: BotRooms,
  discordId: string,
  accountId: string,
  kind: SheetKind,
  unitId: string
) {
  const own = await rooms.account(discordId).unit(discordId, unitId)
  if (own !== null && own.kind === kind) {
    return { unit: own, ownerName: null as string | null, mine: true }
  }
  // A player is in a handful of Games at most; a room answers a stranger null.
  for (const game of await gamesOf(db, accountId)) {
    const unit = await rooms.game(game.gameId).unit(discordId, unitId)
    if (unit !== null && unit.kind === kind) return { unit, ownerName: unit.ownerName, mine: false }
  }
  return null
}

/** One sheet, read-only: the caller's own, a crewmate's, or anybody's published one. */
export async function sheet(
  db: SharedDb,
  rooms: BotRooms,
  args: { discordId: string; table: SheetTable; entityId: string }
): Promise<BotFailure | BotSuccess<SheetResult>> {
  const kind = KIND_OF_TABLE[args.table]
  if (kind === undefined) return botDenial('not-found', SHEET_NOT_FOUND)
  const entityId = args.entityId.trim()
  const account = await accountByDiscordId(db, args.discordId)
  const published = (await publicPage(db, kind, entityId)) as {
    appId: string
    body: EntityBody
  } | null
  const found =
    account === null
      ? null
      : await reachable(db, rooms, args.discordId, account.account_id, kind, entityId)
  if (found !== null) {
    return {
      ok: true,
      table: args.table,
      id: found.unit.id,
      appId: found.unit.id,
      publicRead: published !== null,
      ownerName: found.mine
        ? (account?.display_name ?? account?.name ?? 'Crewmate')
        : found.ownerName,
      body: found.unit.body,
      vitals: found.unit.vitals ?? null,
    }
  }
  if (published !== null) {
    return {
      ok: true,
      table: args.table,
      id: published.appId,
      appId: published.appId,
      publicRead: true,
      ownerName: null,
      body: published.body,
    }
  }
  // Somebody with no account can still read a published sheet, so for them
  // the useful answer is how to sign in rather than a bare not-found.
  return account === null ? botDenial('unlinked') : botDenial('not-found', SHEET_NOT_FOUND)
}
