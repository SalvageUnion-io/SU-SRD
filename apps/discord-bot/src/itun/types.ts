/**
 * The wire shapes the ITUN Convex deployment returns to the bot.
 *
 * These are hand-written rather than imported from `apps/itun`, and that is a
 * deliberate trade rather than an oversight. Importing would drag Convex's
 * generated types — and transitively React — into a Node worker, to describe an
 * interface that is already a network boundary with its own compatibility
 * story. A network payload does not become type-safe by sharing a declaration;
 * it becomes type-safe by being validated where it arrives.
 *
 * The cost is drift: change a `botClient` return shape and nothing here fails
 * to compile. What catches it instead is that these types describe only fields
 * the bot actually renders, every one of them optional-tolerant at the edges,
 * so a *removed* field degrades to "—" rather than throwing. The counterpart
 * tests live in `apps/itun/convex/__tests__/bot.test.ts`, which asserts the
 * shapes this file expects.
 */

/** Why a call could not be satisfied. Mirrors `BotDenial` plus mutation cases. */
export type DenialReason = 'unlinked' | 'unbound' | 'not-a-member' | 'forbidden' | 'not-found'

/**
 * The result of any ITUN call, as three cases the commands must all handle.
 *
 * `unavailable` is separate from `denied` on purpose: it is the bot's
 * **Degraded** mode (ADR-030's three storage modes, applied to the bot). "ITUN
 * is down" and "you are not in this game" want different words, and collapsing
 * them would have every outage read as a permissions problem.
 */
export type ItunResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'denied'; reason: DenialReason; message: string }
  | { kind: 'unavailable'; message: string }

export type GameSummary = {
  gameId: string
  name: string
  mediator: boolean
  organizer: boolean
}

export type MeResult = {
  user: { userId: string; displayName: string; avatarUrl: string | null }
  games: GameSummary[]
}

export type GamesResult = { games: GameSummary[] }

/**
 * An entity body, exactly as Convex stores it — opaque.
 *
 * Convex cannot validate these (ADR-030: the Zod schemas in `apps/itun` are the
 * source of truth and Convex stores bodies as `v.any()`), so the bot must not
 * pretend otherwise. Everything read off a body is read defensively, and the
 * derived maxima come from `salvageunion-reference/rules` rather than from any
 * field claimed to be here.
 */
export type EntityBody = Record<string, unknown>

export type OwnedEntity = {
  id: string
  /**
   * The app-level id, or null.
   *
   * Deep links use THIS, never `id`: the web sheet route resolves an entity out
   * of IndexedDB by its app-level id, so a URL built from the Convex `_id`
   * opens nothing. Null means nobody has claimed the entity into a browser yet,
   * and the bot renders the name without a link rather than a dead one.
   */
  appId: string | null
  ownerId: string | null
  ownerName: string | null
  present: boolean
  body: EntityBody
}

export type CrewResult = {
  game: { gameId: string; name: string }
  viewerId: string
  pilots: OwnedEntity[]
  mechs: OwnedEntity[]
  crawler: { id: string; body: EntityBody } | null
}

export type ShelfResult = {
  pilots: { id: string; appId: string | null; body: EntityBody }[]
  mechs: { id: string; appId: string | null; body: EntityBody }[]
}

export type ChannelResult = {
  game: { gameId: string; name: string }
  members: {
    userId: string
    displayName: string
    present: boolean
    mediator: boolean
    organizer: boolean
  }[]
  downtime: {
    running: boolean
    stepIndex: number | null
    completed: number
    upkeepSpent: boolean
  }
}

export type SheetResult = {
  table: 'pilots' | 'mechs'
  id: string
  appId: string | null
  ownerName: string | null
  body: EntityBody
}

export type BindResult = { name: string }
