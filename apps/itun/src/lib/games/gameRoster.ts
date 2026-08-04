/**
 * What a Game's roster shows, and what each row lets you do (ADR-030 §3–5).
 *
 * This module is deliberately pure — no React, no Convex, no router. Everything
 * on the Game surface that is a *rule* rather than a pixel lives here, for one
 * reason: these answers already exist on the server, in
 * `convex/model/permissions.ts` and `convex/entities.ts`, and a second copy
 * written inline across a component's JSX would drift from them silently. Kept
 * here they can be tested side by side with the mutations they mirror, which is
 * exactly what `__tests__/gameRoster.test.ts` does.
 *
 * **None of this is a boundary.** The server refuses what it refuses whatever
 * this file says; hiding a control the caller cannot use is a courtesy that
 * saves them a failed click and a confusing error. Where the two ever disagree,
 * the server is right and this file is the bug.
 */

import type { OwnerChip } from '../ownership/ownerChip'
import { ownerChipFor } from '../ownership/ownerChip'

export type RosterKind = 'pilot' | 'mech' | 'crawler'

/** A pilot or mech as `entities.listForGame` returns it. */
export type ServerOwnable = {
  _id: string
  appId: string | null
  ownerId: string | null
  body: unknown
}

/** A crawler as `entities.listForGame` returns it — communal, so no owner. */
export type ServerCrawler = {
  _id: string
  appId: string | null
  body: unknown
}

/** A member as `games.members` returns it. */
export type GameMember = {
  userId: string
  displayName: string
  mediator: boolean
  organizer: boolean
}

/** What the viewer may do with one row. */
export type RowCapabilities = {
  /** The viewer may open the row's EDITABLE live sheet. Mirrors `assertMayWrite`. */
  openSheet: boolean
  /** Free, and the viewer is in the Game: they can take it. */
  claim: boolean
  /** The viewer holds it and can hand it back to the crew. */
  release: boolean
  /** Crawler only: the table runner may scrap it. */
  scrap: boolean
}

export type RosterRow = {
  kind: RosterKind
  /** The Convex row id — what every ownership mutation is addressed by. */
  serverId: string
  /** The id the owner's browser minted, when this row was ever in one. */
  appId: string | null
  name: string
  ownerId: string | null
  /** Null for a crawler: it is communal, so "who owns it" is not a question. */
  owner: OwnerChip | null
  /** Set when this browser already holds a copy — the id a sheet route takes. */
  localId: string | null
  body: Record<string, unknown>
  can: RowCapabilities
}

/** What the viewer may do to the Game as a whole. */
export type TableCapabilities = {
  /** The Mediator, or the Organizer while the Game has no Mediator. */
  tableRunner: boolean
  hasCrawler: boolean
  /** Raising and scrapping a crawler is the table runner's act. */
  canRaiseCrawler: boolean
  /** Whether the viewer may add pilots and mechs to this Game right now. */
  canAddCrew: boolean
  /** Why not, in the surface's own words. Null when they can. */
  addCrewBlocked: string | null
  /** Only the table runner may leave a new character unclaimed for the crew. */
  canOfferUnclaimed: boolean
}

/**
 * The viewer's standing in this Game.
 *
 * Mirrors `isTableRunner`: Mediator, or Organizer *only while nobody mediates*.
 * The fallback is computed from the roster rather than assumed, so appointing a
 * Mediator withdraws it here at the same moment it does on the server.
 */
export function isTableRunner(viewerId: string | null, members: readonly GameMember[]): boolean {
  if (viewerId === null) return false
  const me = members.find((m) => m.userId === viewerId)
  if (me === undefined) return false
  if (me.mediator) return true
  return me.organizer && !members.some((m) => m.mediator)
}

/**
 * What the viewer may do to this Game.
 *
 * The crawler gate is the interesting one, and the wording matters as much as
 * the boolean: a player who cannot add a pilot yet is not being refused, they
 * are waiting for the table to be set up, and a surface that says "you can't"
 * without saying "yet, because —" reads as a broken button.
 */
export function tableCapabilities(args: {
  viewerId: string | null
  members: readonly GameMember[]
  crawlerCount: number
}): TableCapabilities {
  const tableRunner = isTableRunner(args.viewerId, args.members)
  const hasCrawler = args.crawlerCount > 0
  const canAddCrew = tableRunner || hasCrawler

  return {
    tableRunner,
    hasCrawler,
    canRaiseCrawler: tableRunner,
    canAddCrew,
    addCrewBlocked: canAddCrew
      ? null
      : 'This game has no Union Crawler yet. The Mediator raises one first — the crew is anchored to it.',
    canOfferUnclaimed: tableRunner,
  }
}

/** Best-effort display name off an opaque server body. */
function nameOf(body: unknown, fallback: string): string {
  const value = (body as Record<string, unknown> | null)?.name
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

/** The body as a record, so callers can read known fields without casting. */
function bodyOf(body: unknown): Record<string, unknown> {
  return (body ?? {}) as Record<string, unknown>
}

/**
 * Build the pilot/mech rows for a Game.
 *
 * `localIds` is the set of entity ids this browser already holds. It decides
 * whether a row can open a sheet *without a round trip*, not whether it may —
 * see `openSheet` below.
 *
 * `openSheet` means the EDITABLE live sheet, so it mirrors `assertMayWrite`:
 * only the owner. That is not the same as "only the owner may look" — ADR-030
 * §5 allows reading a crewmate's sheet, and every row is now readable through
 * the frozen crew view (`GameEntitySheet`), which renders the server body
 * behind a store that throws on write and caches nothing locally.
 *
 * The distinction is the whole point. What was never safe was handing a
 * non-owner ITUN's *live* sheet — an editing surface backed by local storage,
 * whose writes the server then refuses, so it would silently stop saving. A
 * read-only surface has no such failure mode, so reading needs no capability
 * flag here: membership in the Game is the only gate, and the server's own
 * listing query already enforces it.
 */
export function ownableRows(args: {
  kind: 'pilot' | 'mech'
  rows: readonly ServerOwnable[]
  viewerId: string | null
  members: readonly GameMember[]
  localIds: ReadonlySet<string>
}): RosterRow[] {
  const namesById = new Map(args.members.map((m) => [m.userId, m.displayName]))
  const lookup = { viewerId: args.viewerId, namesById }
  const memberOfGame = args.viewerId !== null

  return args.rows.map((row) => {
    const owner = ownerChipFor(row.ownerId, lookup)
    const mine = owner.mine
    const localId = row.appId !== null && args.localIds.has(row.appId) ? row.appId : null

    return {
      kind: args.kind,
      serverId: row._id,
      appId: row.appId,
      name: nameOf(row.body, args.kind === 'pilot' ? 'Pilot' : 'Mech'),
      ownerId: row.ownerId,
      owner,
      localId,
      body: bodyOf(row.body),
      can: {
        openSheet: mine,
        claim: memberOfGame && owner.unclaimed,
        release: mine,
        scrap: false,
      },
    }
  })
}

/**
 * Build the crawler rows for a Game.
 *
 * Every row opens: the crawler is communal, so any member may read and edit its
 * fields, which is precisely the split this feature turns on — the table runner
 * decides a crawler *exists*, the crew keeps its scrap, cargo and bays.
 */
export function crawlerRows(args: {
  rows: readonly ServerCrawler[]
  tableRunner: boolean
  localIds: ReadonlySet<string>
}): RosterRow[] {
  return args.rows.map((row) => ({
    kind: 'crawler' as const,
    serverId: row._id,
    appId: row.appId,
    name: nameOf(row.body, 'Union Crawler'),
    ownerId: null,
    owner: null,
    localId: row.appId !== null && args.localIds.has(row.appId) ? row.appId : null,
    body: bodyOf(row.body),
    can: {
      openSheet: true,
      claim: false,
      release: false,
      scrap: args.tableRunner,
    },
  }))
}
