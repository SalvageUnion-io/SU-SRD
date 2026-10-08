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

import type { Container } from '../container'
import { sameContainer } from '../container'
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
  /**
   * The row's sheet opens EDITABLE for the viewer. Mirrors `assertMayWrite`.
   * Every row opens (`rosterSheetHref`); this only says whether it opens to edit.
   */
  openSheet: boolean
  /** Free, and the viewer is in the Game: they can take it. */
  claim: boolean
  /** The viewer holds it and can hand it back to the crew. */
  release: boolean
  /** Crawler only: the table runner may scrap it. */
  scrap: boolean
  /** Crawler only: the table runner may make it the Game's primary (ADR-037). */
  makePrimary: boolean
  /**
   * The viewer may take this row out of the Game, to My Stuff — the move rules
   * of ADR-037 read from inside the Game: a pilot or mech by its owner, a
   * crawler by the table runner (`entities.moveCrawler`). `moveDestinations`
   * is the same rule read from the entity's side.
   */
  removeFromGame: boolean
  /**
   * The viewer may destroy this row outright. Mirrors `removeByAppId`, so:
   * the owner, and nobody else.
   *
   * A Game had no delete at all until now — only "Offer to the crew", which
   * hands a character over rather than ending it. That left the ordinary case
   * of a mistaken build with no way out except leaving it on the roster
   * forever, and the feedback was the blunt version: "u can't delete pilots or
   * mechs". The server has always allowed it; only the surface was missing.
   *
   * Deliberately distinct from `release`. Releasing is generous and reversible
   * — somebody else picks the character up. Deleting is neither, which is why
   * the two are separate verbs with separate confirms rather than one control
   * that guesses.
   */
  delete: boolean
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
  /** Crawler only: the Game's primary — where new crew is assigned (ADR-037). */
  primary: boolean
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
  /** Whether the viewer may add pilots and mechs to this Game: any member may. */
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
 * Whether anybody mediates this Game. Mirrors `gameHasMediator` in
 * `convex/model/permissions.ts`. The Dashboard opens only when this is true
 * (ADR-038 §1), so the roster offers Play by it and the route checks it live.
 */
export function gameHasMediator(members: readonly GameMember[]): boolean {
  return members.some((m) => m.mediator)
}

/**
 * What the viewer may do to this Game.
 *
 * Any member may bring pilots and mechs in, crawler or not — mirroring
 * `assertMayAddToContainer`, which dropped its crawler gate (ADR-037): the crew
 * gathers first, and the first crawler raised picks everyone up.
 */
export function tableCapabilities(args: {
  viewerId: string | null
  members: readonly GameMember[]
  crawlerCount: number
}): TableCapabilities {
  const tableRunner = isTableRunner(args.viewerId, args.members)
  const hasCrawler = args.crawlerCount > 0
  const canAddCrew = args.viewerId !== null && args.members.some((m) => m.userId === args.viewerId)

  return {
    tableRunner,
    hasCrawler,
    canRaiseCrawler: tableRunner,
    canAddCrew,
    addCrewBlocked: canAddCrew ? null : 'Only members of this game can bring builds into it.',
    canOfferUnclaimed: tableRunner,
  }
}

/** A Game as `games.listMine` returns it, as far as moving goes. */
export type MoveTargetGame = { _id: string; name: string; tableRunner: boolean }

/** One option in a move control: where it goes, and what it is called. */
export type MoveDestination = { container: Container; label: string }

/**
 * Where the viewer may move one of their entities to — mirroring the server's
 * move rules (ADR-037), so the control lists only what would be accepted.
 *
 *  - A **pilot or mech** may go to My Stuff or to any Game the viewer belongs
 *    to (`upsertByAppId` + `assertMayAddToContainer`; leaving needs only
 *    ownership, which a live sheet already implies).
 *  - A **crawler** moves only at its table runner's hand
 *    (`entities.moveCrawler`): from My Stuff into a Game they run, or from a
 *    Game they run back to My Stuff — never Game to Game.
 *
 * The current container is always first, so a control can show where the
 * entity is even when it may go nowhere else.
 */
export function moveDestinations(args: {
  kind: RosterKind
  current: Container
  games: readonly MoveTargetGame[]
}): MoveDestination[] {
  const shelf: MoveDestination = { container: { kind: 'shelf' }, label: 'My Stuff' }
  const toGame = (g: MoveTargetGame): MoveDestination => ({
    container: { kind: 'game', gameId: g._id },
    label: g.name,
  })
  const { current } = args
  const currentGame =
    current.kind === 'game' ? args.games.find((g) => g._id === current.gameId) : undefined
  // A record filed under a Game the viewer is not in (left, or a v13 phantom)
  // is shown as such rather than as My Stuff, which would lie about where it is.
  const here: MoveDestination =
    current.kind === 'shelf'
      ? shelf
      : currentGame !== undefined
        ? toGame(currentGame)
        : { container: current, label: 'Unknown game' }
  const others = (destinations: MoveDestination[]) =>
    destinations.filter((d) => !sameContainer(d.container, current))

  if (args.kind !== 'crawler') {
    return [here, ...others([shelf, ...args.games.map(toGame)])]
  }
  if (current.kind === 'shelf') {
    return [here, ...others(args.games.filter((g) => g.tableRunner).map(toGame))]
  }
  const runsThisTable = args.games.some((g) => g._id === current.gameId && g.tableRunner)
  return runsThisTable ? [here, shelf] : [here]
}

/** One column of a Game's roster, as the hub lists it. */
export type RosterColumnGroups = {
  /** The viewer's own rows — listed first, under YOURS. */
  yours: RosterRow[]
  /** Everyone else's, unclaimed included; the primary crawler leads. */
  others: RosterRow[]
}

/**
 * Split a column into the viewer's own rows and everyone else's.
 *
 * Yours lead because they are what you came to act on; the rest of the table
 * is context. A crawler belongs to nobody, so a crawler column is all `others`,
 * with the primary first — it is where new crew is assigned (ADR-037), so it
 * is the one a reader looks for. The order is otherwise the listing's.
 */
export function groupColumn(rows: readonly RosterRow[]): RosterColumnGroups {
  const yours = rows.filter((row) => row.owner?.mine === true)
  const others = rows
    .filter((row) => row.owner?.mine !== true)
    .sort((a, b) => Number(b.primary) - Number(a.primary))
  return { yours, others }
}

/**
 * The sheet a row opens: the live sheet route, one address whoever looks —
 * `SheetView` makes it editable or read-only. Addressed by the app id every
 * link uses; a template pre-gen has none and goes by its body id, and a row with
 * neither by its row id, which the route also resolves.
 */
export function rosterSheetHref(row: RosterRow): string {
  const bodyId = typeof row.body.id === 'string' && row.body.id.length > 0 ? row.body.id : null
  return `/sheet/${row.kind}/${row.appId ?? bodyId ?? row.serverId}`
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
 * `openSheet` means the sheet opens EDITABLE, so it mirrors `assertMayWrite`:
 * only the owner. That is not the same as "only the owner may look" — ADR-030
 * §5 allows reading a crewmate's sheet, and every row opens the same live
 * sheet, which renders a crewmate's read-only from the Game's listing behind a
 * store that throws on write and caches nothing locally (`SheetView`).
 *
 * The distinction is the whole point. What was never safe was handing a
 * non-owner ITUN's *editable* sheet — an editing surface backed by local
 * storage, whose writes the server then refuses, so it would silently stop
 * saving. A read-only rendering has no such failure mode, so reading needs no
 * capability flag here: membership in the Game is the only gate, and the
 * server's own queries already enforce it.
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
      primary: false,
      body: bodyOf(row.body),
      can: {
        openSheet: mine,
        claim: memberOfGame && owner.unclaimed,
        release: mine,
        scrap: false,
        makePrimary: false,
        removeFromGame: mine,
        delete: mine,
      },
    }
  })
}

/**
 * Build the crawler rows for a Game.
 *
 * Every row opens: every member reads the crawler. Only the table runner
 * edits it (ADR-038 §5), and `SheetView` opens it read-only for anyone else.
 */
export function crawlerRows(args: {
  rows: readonly ServerCrawler[]
  tableRunner: boolean
  localIds: ReadonlySet<string>
  /** `listForGame().primaryCrawlerId` — the Game's primary, or null. */
  primaryCrawlerId?: string | null
}): RosterRow[] {
  return args.rows.map((row) => {
    const primary = row._id === args.primaryCrawlerId
    return {
      kind: 'crawler' as const,
      serverId: row._id,
      appId: row.appId,
      name: nameOf(row.body, 'Union Crawler'),
      ownerId: null,
      owner: null,
      localId: row.appId !== null && args.localIds.has(row.appId) ? row.appId : null,
      primary,
      body: bodyOf(row.body),
      can: {
        openSheet: true,
        claim: false,
        release: false,
        scrap: args.tableRunner,
        // Mirrors `games.setPrimaryCrawler`: the table runner's call.
        makePrimary: args.tableRunner && !primary,
        // Mirrors `entities.moveCrawler`: only the table runner moves a crawler.
        removeFromGame: args.tableRunner,
        // A crawler is destroyed by scrapping it, which is the table runner's act
        // and already has its own control. A second delete verb beside it would
        // be the same destruction under a name the rules do not use.
        delete: false,
      },
    }
  })
}
