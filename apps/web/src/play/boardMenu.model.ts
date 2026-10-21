/**
 * The mechs Play offers to board in a Game (`PlayMountRow`, the Units' Board;
 * ADR-038 §3's boarding menu and §5, kept by ADR-051).
 *
 * It lists the pilot's assigned mech (`mech-to-pilot`) and every mech assigned
 * to the pilot's crawler (`mech-to-crawler`), the pilot's own first; with no
 * crawler it lists only the viewer's own mechs in the Game. Each entry is in
 * one state:
 *
 *   - **yours:** boards;
 *   - **spare** (unclaimed): "Claim and board", behind a confirm. It claims
 *     through `ownership.claim`, then boards. It draws no `mech-to-pilot` link
 *     (ADR-038 §5), so the assigned mech stays the assigned one afterwards;
 *   - **others** (another player's), **destroyed**, **aboard** (another seat is
 *     boarded in it): listed, disabled, with the reason.
 *
 * Pure, and none of it is a boundary: `seats.board` and `ownership.claim`
 * refuse what they refuse whatever this says. It mirrors them so a player sees
 * why before pressing, not after.
 *
 * It also declares the crew read types (`CrewRow`, `CrewLink`, `BoardSources`)
 * that `crew.model.ts` and `mediatorTable.model.ts` import.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { SeatMount, SeatResolving } from 'game-domain/schemas/seat'

/** A pilot or mech row as `entities.listForGame` returns it. */
export type CrewRow = {
  _id: string
  appId: string | null
  ownerId: string | null
  body: unknown
}

/** A soft link as `entities.listForGame` returns it. */
export type CrewLink = {
  type: string
  from: { type: string; id: string }
  to: { type: string; id: string }
}

/** What the menu reads from the Game, all of it from Convex. */
export type BoardSources = {
  /** `entities.listForGame`, or null before it arrives. */
  listing: {
    pilots: readonly CrewRow[]
    mechs: readonly CrewRow[]
    softLinks: readonly CrewLink[]
  } | null
  /**
   * `seats.forGame`: every pilot's mount in the Game, and what they are
   * resolving (Play's Crew reads that; this menu does not).
   */
  seats: readonly { pilotId: string; mount: SeatMount; resolving?: SeatResolving | null }[]
  /** The signed-in viewer (`account.me`), or null before it arrives. */
  viewerId: string | null
}

type BoardState = 'yours' | 'spare' | 'others' | 'destroyed' | 'aboard'

export type BoardOption = {
  /** The mech's app id: what a seat and a link end address it by. */
  mechId: string
  /** The Convex row id `ownership.claim` takes, or null when known only locally. */
  serverId: string | null
  name: string
  state: BoardState
  /** Why it can't be boarded, or that it is a spare; null for your own. */
  note: string | null
}

/** Whether choosing this option does anything: your own boards, a spare is claimed first. */
export function boardable(option: BoardOption): boolean {
  return option.state === 'yours' || option.state === 'spare'
}

function bodyField(body: unknown, field: string): unknown {
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)[field]
    : undefined
}

/** The id links and seats use: the app id, or a template pre-gen's body id. */
function linkId(row: CrewRow): string | null {
  if (row.appId !== null) return row.appId
  const id = bodyField(row.body, 'id')
  return typeof id === 'string' && id.length > 0 ? id : null
}

/** A listed entity's name, from its body. */
function nameOf(body: unknown, fallback: string): string {
  const name = bodyField(body, 'name')
  return typeof name === 'string' && name.length > 0 ? name : fallback
}

/**
 * The state of one mech, by the rules `seats.board` applies in its order:
 * destroyed, then aboard elsewhere, then whose it is.
 */
function stateOf(args: {
  destroyed: boolean
  aboard: string | null
  owner: 'yours' | 'spare' | 'others'
}): Pick<BoardOption, 'state' | 'note'> {
  if (args.destroyed) return { state: 'destroyed', note: 'Destroyed' }
  if (args.aboard !== null) return { state: 'aboard', note: `${args.aboard} is aboard` }
  if (args.owner === 'spare') return { state: 'spare', note: 'Unclaimed spare' }
  if (args.owner === 'others') return { state: 'others', note: 'Another player’s mech' }
  return { state: 'yours', note: null }
}

export function boardMenu(args: {
  pilotId: string
  /** The pilot's assigned mech (`mech-to-pilot`) from the local store, if any. */
  assigned: Mech | null
  sources: BoardSources
}): BoardOption[] {
  const { pilotId, assigned, sources } = args
  const { listing, viewerId } = sources

  // Who is aboard each mech, by the boarding pilot's name. The pilot's own seat
  // is not "another seat".
  const pilotName = new Map<string, string>()
  for (const p of listing?.pilots ?? []) {
    const id = linkId(p)
    if (id !== null) pilotName.set(id, nameOf(p.body, 'Another pilot'))
  }
  const aboard = new Map<string, string>()
  for (const seat of sources.seats) {
    if (seat.pilotId === pilotId || seat.mount.kind !== 'boarded') continue
    aboard.set(seat.mount.mechId, pilotName.get(seat.pilotId) ?? 'Another pilot')
  }

  // The assigned mech as the local store has it, which holds only the viewer's
  // own: what the menu knows before the Game's listing (or the viewer) arrives,
  // or while a just-assigned mech has yet to reach it.
  const local = (mech: Mech): BoardOption => ({
    mechId: mech.id,
    serverId: null,
    name: mech.name,
    ...stateOf({
      destroyed: mech.destroyed === true,
      aboard: aboard.get(mech.id) ?? null,
      owner: 'yours',
    }),
  })

  if (listing === null || viewerId === null) {
    return assigned === null ? [] : [local(assigned)]
  }

  const crawlerId =
    listing.softLinks.find((l) => l.type === 'pilot-to-crawler' && l.from.id === pilotId)?.to.id ??
    null
  const onCrawler = new Set(
    listing.softLinks
      .filter((l) => l.type === 'mech-to-crawler' && l.to.id === crawlerId)
      .map((l) => l.from.id)
  )

  // The pilot's own first: the assigned mech, then the viewer's, then the rest
  // in the listing's order (the sort is stable).
  const ranked: { option: BoardOption; rank: number }[] = []
  for (const row of listing.mechs) {
    const mechId = linkId(row)
    if (mechId === null) continue
    const listed =
      mechId === assigned?.id ||
      (crawlerId === null ? row.ownerId === viewerId : onCrawler.has(mechId))
    if (!listed) continue
    const option: BoardOption = {
      mechId,
      serverId: row._id,
      name: nameOf(row.body, 'Mech'),
      ...stateOf({
        destroyed: bodyField(row.body, 'destroyed') === true,
        aboard: aboard.get(mechId) ?? null,
        owner: row.ownerId === null ? 'spare' : row.ownerId === viewerId ? 'yours' : 'others',
      }),
    }
    ranked.push({ option, rank: mechId === assigned?.id ? 0 : row.ownerId === viewerId ? 1 : 2 })
  }
  const options = ranked.sort((a, b) => a.rank - b.rank).map((r) => r.option)

  if (assigned === null || options.some((o) => o.mechId === assigned.id)) return options
  return [local(assigned), ...options]
}
